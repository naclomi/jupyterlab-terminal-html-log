import fs from 'fs';
import path from 'path';

import { expect, test } from '@jupyterlab/galata';

const TERMINAL_SELECTOR = '.jp-Terminal';
const COMMAND_LABEL = 'Log to HTML file';

const LOGGED_TEXT = 'foo bar bazz';
const NOT_LOGGED_TEXT = 'womp murrr';

const LOG_FILE_NAME = 'test_log.html';

test('should log terminal activity to an html file', async ({ page }) => {
  // Open a terminal
  await page.menu.clickMenuItem('File>New>Terminal');
  await page.locator(TERMINAL_SELECTOR).waitFor();
  const terminal = page.locator(TERMINAL_SELECTOR);
  await terminal.waitFor();

  // Find and click the logging command in the terminal's context menu
  await terminal.click({
    button: 'right'
  });
  await expect(
    page.getByRole('menuitem', { name: COMMAND_LABEL })
  ).toBeVisible();
  await page.getByRole('menuitem', { name: COMMAND_LABEL }).click();

  // Accept the default folder to save the log file into
  await page.getByRole('button', { name: 'Select' }).click();

  // Name the file "test.html"
  await page.locator('.jp-Dialog >> input[type="text"]').waitFor();
  await page.fill('.jp-Dialog >> input[type="text"]', LOG_FILE_NAME);
  await page.click('.jp-Dialog >> button >> text=Ok');

  // Write content that should be logged
  await page.waitForTimeout(1000);
  await terminal.click();
  await page.keyboard.type(`echo ${LOGGED_TEXT}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Turn logging off
  await terminal.click({
    button: 'right'
  });
  await page.getByRole('menuitem', { name: COMMAND_LABEL }).click();

  // Write content that should _not_ be logged
  await page.waitForTimeout(1000);
  await terminal.click();
  await page.keyboard.type(`echo ${NOT_LOGGED_TEXT}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Load logged output
  const fs_log_path = path.join(await page.getServerRoot(), LOG_FILE_NAME);
  const log_data = fs.readFileSync(fs_log_path, { encoding: 'utf8' });

  // Confirm contents
  expect([...log_data.matchAll(LOGGED_TEXT)].length).toEqual(2);
  expect([...log_data.matchAll(NOT_LOGGED_TEXT)].length).toEqual(0);
});
