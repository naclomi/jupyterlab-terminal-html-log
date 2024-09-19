import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab_terminal_html_log extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_terminal_html_log:plugin',
  description: 'Add HTML logging capabilities to JupyterLab\'s integrated terminal',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab_terminal_html_log is activated!');
  }
};

export default plugin;
