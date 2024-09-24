import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, InputDialog, showErrorMessage } from '@jupyterlab/apputils';

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

        // Get log path
        let log_path = null;

        const dialog = FileDialog.getOpenFiles({
          "manager": docManager,
          "title": "Select log destination",
          "label": "Choose a pre-existing file to overwrite or a directory to create a new file within it",
          "filter": model => {return (model.mimetype === 'text/html' || model.type === 'directory') ? {} : null}
        });
        const file_picker_result = await dialog;
        if(file_picker_result.button.accept){
          if (file_picker_result.value!.length > 1) {
            showErrorMessage("Too many items selected", "Please select only one file or directory");
          } else {
            let selected = file_picker_result.value![0];
            if (selected.type == "directory") {
              const file_name_result = await InputDialog.getText({
                title: 'Enter a filename for the log',
                label: selected.path + "/"
              });
              if (file_name_result.button.accept) {
                log_path = selected.path + "/" + file_name_result.value;
              }
            } else {
              log_path = "/" + selected.path;
            }
            console.log(selected);
          }
        }

        // Start logger
        if (log_path) {
          console.log(log_path);
          console.log(docManager.services)
          docManager.services.contents.save(log_path, {
            content: "foo",
            format: "text",
            mimetype: "text/html",
            type: "file"
          })
        }
      }
    });

    // Add the command to the palette.
    palette.addItem({ command, category: 'terminal' });

  }
};

export default logger;
