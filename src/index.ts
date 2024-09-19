import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { FileDialog } from '@jupyterlab/filebrowser';

/**
 * Initialization data for the jupyterlab_terminal_html_log extension.
 */
const logger: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_terminal_html_log:logger',
  description: 'Add HTML logging capabilities to JupyterLab\'s integrated terminal',
  requires: [ICommandPalette, IDocumentManager],
  autoStart: true,
  activate: (app: JupyterFrontEnd, palette: ICommandPalette, docManager: IDocumentManager) => {
    const command: string = 'terminal:log-to-html';
    app.commands.addCommand(command, {
      label: 'Toggle logging to HTML file',
      execute: async () => {
        const dialog = FileDialog.getOpenFiles({
          "manager": docManager,
          // filter: model => model.type == 'notebook' // optional (model: Contents.IModel) => boolean
        });

        const result = await dialog;

        if(result.button.accept){
          let files = result.value;
          console.log(files);
        }

      }
    });

    // Add the command to the palette.
    palette.addItem({ command, category: 'terminal' });

  }
};

export default logger;
