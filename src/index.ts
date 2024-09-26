import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
  InputDialog,
  showErrorMessage
} from '@jupyterlab/apputils';

import { ITerminalTracker, ITerminal } from '@jupyterlab/terminal';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { FileDialog } from '@jupyterlab/filebrowser';

import type {
  Terminal as Xterm,
  IDisposable as XtermIDisposable,
  IBufferCell
} from '@xterm/xterm';

function getInternalXtermWidget(
  termWidget: ITerminal.ITerminal
): Xterm | undefined {
  if ('_term' in termWidget) {
    return termWidget._term as Xterm;
  }
}

async function getLogDestination(
  docManager: IDocumentManager
): Promise<string | null> {
  let log_path = null;
  const dialog = FileDialog.getOpenFiles({
    manager: docManager,
    title: 'Select log destination',
    label:
      'Choose a pre-existing file to overwrite or a directory to create a new file within it',
    filter: model => {
      return model.mimetype === 'text/html' || model.type === 'directory'
        ? {}
        : null;
    }
  });
  const file_picker_result = await dialog;
  if (file_picker_result.button.accept) {
    if (file_picker_result.value!.length > 1) {
      showErrorMessage(
        'Too many items selected',
        'Please select only one file or directory'
      );
    } else {
      const selected = file_picker_result.value![0];
      if (selected.type === 'directory') {
        const file_name_result = await InputDialog.getText({
          title: 'Enter a filename for the log',
          label: selected.path + '/'
        });
        if (file_name_result.button.accept) {
          log_path = selected.path + '/' + file_name_result.value;
        }
      } else {
        log_path = '/' + selected.path;
      }
    }
  }
  return log_path;
}

export const DEFAULT_ANSI_COLORS = Object.freeze(
  (() => {
    // Adapted from xterm.js source:
    // https://github.com/xtermjs/xterm.js/blob/f56675f7e58da2f1661beda64b91039c14dba09a/src/browser/Types.ts#L181

    function toPaddedHex(c: number): string {
      const s = c.toString(16);
      return s.length < 2 ? '0' + s : s;
    }

    function toCss(r: number, g: number, b: number, a?: number): string {
      if (a !== undefined) {
        return `#${toPaddedHex(r)}${toPaddedHex(g)}${toPaddedHex(b)}${toPaddedHex(a)}`;
      }
      return `#${toPaddedHex(r)}${toPaddedHex(g)}${toPaddedHex(b)}`;
    }

    const colors = [
      // dark:
      '#2e3436',
      '#cc0000',
      '#4e9a06',
      '#c4a000',
      '#3465a4',
      '#75507b',
      '#06989a',
      '#d3d7cf',
      // bright:
      '#555753',
      '#ef2929',
      '#8ae234',
      '#fce94f',
      '#729fcf',
      '#ad7fa8',
      '#34e2e2',
      '#eeeeec'
    ];

    // Fill in the remaining 240 ANSI colors.
    // Generate colors (16-231)
    const v = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
    for (let i = 0; i < 216; i++) {
      const r = v[(i / 36) % 6 | 0];
      const g = v[(i / 6) % 6 | 0];
      const b = v[i % 6];
      colors.push(toCss(r, g, b));
    }

    // Generate greys (232-255)
    for (let i = 0; i < 24; i++) {
      const c = 8 + i * 10;
      colors.push(toCss(c, c, c));
    }

    return colors;
  })()
);

class XtermTracker {
  session_id: string;
  xt: Xterm;
  disposed: boolean;
  lastLogLine: number;
  listeners: Array<XtermIDisposable>;
  log: string;
  dump_callback: (data: string) => void;

  constructor(
    session_id: string,
    xt: Xterm,
    dump_callback: (data: string) => void
  ) {
    this.session_id = session_id;
    this.xt = xt;
    this.disposed = false;
    this.lastLogLine = 0;
    this.listeners = [
      this.xt.onLineFeed(this.onLineFeed.bind(this)),
      this.xt.onKey(this.onKey.bind(this))
    ];
    this.dump_callback = dump_callback;
    this.log = '';
    this.onLineFeed();
    this.dump_callback(this.dump());
  }

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      for (const listener of this.listeners) {
        listener.dispose();
      }
    }
  }

  dump(): string {
    return (
      `
<html>
  <head>
    <style>
      body {
        background: ${this.xt.options.theme?.background || '#000000'};
        font-family: ${this.xt.options.fontFamily || 'monospace'};
        font-weight: ${this.xt.options.fontWeight || 'normal'};
        margin: 1em;
      }
    </style>
  </head>
  <body><pre>` +
      this.log +
      '</pre></body></html>'
    );
  }

  rewind(num_lines: number): void {
    let idx = this.log.length;
    for (let line_count = 0; line_count < num_lines; line_count++) {
      idx = this.log.lastIndexOf('\n', idx - 1);
    }
    this.log = this.log.slice(0, idx + 1);
  }

  onKey(event: { key: string; domEvent: KeyboardEvent }) {
    if (event.key === '\r' || event.key === '\n') {
      setTimeout(() => {
        this.dump_callback(this.dump());
      }, 500);
    }
  }

  onLineFeed(): void {
    if (this.disposed) {
      return;
    }
    if (!this.xt.modes.applicationCursorKeysMode) {
      const buffer = this.xt.buffer.active;
      const theme =
        this.xt.options.theme === undefined
          ? { foreground: '#ffffff', background: '#000000' }
          : this.xt.options.theme;
      const bufferMaxY = buffer.baseY + buffer.cursorY - 1;
      if (this.lastLogLine > bufferMaxY) {
        this.rewind(this.lastLogLine - bufferMaxY);
        this.lastLogLine = bufferMaxY;
      }
      let html = '';
      for (; this.lastLogLine <= bufferMaxY; this.lastLogLine += 1) {
        const line = buffer.getLine(this.lastLogLine);
        if (!line) {
          continue;
        }
        let cell: IBufferCell | undefined = buffer.getNullCell();
        let line_html = '<span>';
        let lastFgColorRaw = undefined;
        let lastBgColorRaw = undefined;
        let lastBold = undefined;

        for (let col = 0; col < line.length; col += 1) {
          cell = line.getCell(col, cell);
          if (!cell) {
            continue;
          }

          let fgColorRaw = cell.getFgColor();
          let bgColorRaw = cell.getBgColor();
          const bold = cell.isBold();

          // Bold text in brighter colors
          // See: https://github.com/xtermjs/xterm.js/blob/da93a35671489477e6e0b5ebc164d974b7896a9d/src/browser/renderer/TextRenderLayer.ts#L255
          if (bold && cell.isFgPalette()) {
            fgColorRaw += 8;
          }
          if (bold && cell.isBgPalette()) {
            bgColorRaw += 8;
          }

          if (
            fgColorRaw !== lastFgColorRaw ||
            bgColorRaw !== lastBgColorRaw ||
            bold !== lastBold
          ) {
            const fgColor =
              fgColorRaw === -1
                ? theme.foreground
                : fgColorRaw <= 255
                  ? DEFAULT_ANSI_COLORS[fgColorRaw]
                  : fgColorRaw;
            const bgColor =
              bgColorRaw === -1
                ? theme.background
                : bgColorRaw <= 255
                  ? DEFAULT_ANSI_COLORS[bgColorRaw]
                  : bgColorRaw;
            let fontProps = '';
            if (bold) {
              fontProps += 'font-weight: bold; ';
            }
            line_html += `</span><span style="color: ${fgColor}; background-color: ${bgColor}; ${fontProps}">`;
          }

          let char = cell.getChars();
          if (char === '') {
            char = ' ';
          }
          line_html += char;

          lastFgColorRaw = fgColorRaw;
          lastBgColorRaw = bgColorRaw;
          lastBold = bold;
        }
        line_html += '</span>\n';
        html += line_html;
      }
      this.log += html;
    }
  }
}

/**
 * Initialization data for the jupyterlab_terminal_html_log extension.
 */
const logger: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_terminal_html_log:logger',
  description:
    "Add HTML logging capabilities to JupyterLab's integrated terminal",
  requires: [ICommandPalette, IDocumentManager, ITerminalTracker],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    docManager: IDocumentManager,
    termTracker: ITerminalTracker
  ) => {
    const loggers: { [key: string]: XtermTracker } = {};

    const command: string = 'terminal:log-to-html';
    app.commands.addCommand(command, {
      label: 'Log to HTML file',
      isToggled: () => {
        return (
          termTracker.currentWidget !== null &&
          termTracker.currentWidget === app.shell.currentWidget &&
          termTracker.currentWidget.content.session.name in loggers
        );
      },
      isEnabled: () => {
        return (
          termTracker.currentWidget !== null &&
          termTracker.currentWidget === app.shell.currentWidget
        );
      },
      execute: async () => {
        if (termTracker.currentWidget) {
          const session_name = termTracker.currentWidget.content.session.name;
          if (session_name in loggers) {
            // Turn logging off
            loggers[session_name].dispose();
            delete loggers[session_name];
          } else {
            // Turn logging on

            // TODO: careful about widget lifecycle/disposals, this is technically
            //       an internal widget member and we don't know how persistent it is
            const xt = getInternalXtermWidget(
              termTracker.currentWidget.content
            );

            // Get log path
            const log_path = await getLogDestination(docManager);

            // Start logger
            if (log_path !== null && xt) {
              loggers[session_name] = new XtermTracker(
                session_name,
                xt,
                data => {
                  docManager.services.contents.save(log_path!, {
                    content: data,
                    format: 'text',
                    mimetype: 'text/html',
                    type: 'file'
                  });
                }
              );
              termTracker.currentWidget.content.disposed.connect(() => {
                loggers[session_name].dispose();
                delete loggers[session_name];
              });
            }
          }
        }
      }
    });

    // Add the command to the palette.
    palette.addItem({ command, category: 'terminal' });
  }
};

export default logger;
