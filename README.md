# smartcomments-demo README

This is the demo for the Automated Comment Generation.

## Features

There is a simplistic UI, that tracks the last changes in the user's file and after a few seconds shows an AI generated inline comment. With the accept button the comment is written into the file at the right place. For the AI we used https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct integrated over the Huggingface API.

## Testing Guide
Follow these steps if you want to test this extension out for yourselves:

1. Install VS Code or Cursor: https://code.visualstudio.com/download , https://www.cursor.com/
2. Install Git https://git-scm.com/downloads and Node.js https://nodejs.org/en
3. Clone the Repo or just download the .zip
4. Open the Project in VS Code
5. You need to set your Huggingface API key/token by presing ´Ctrl + Shift + P´ and searching ´Open User Settings´. There you search for ´Hugging Face API´ and you should see an input box where you can place your Key/token.
6. Press f5
This should open a new VS Code window for testing the extension.
7. You can use this new window normally. Open the extension UI by clicking the extension icon. Create a python file and type some code, than you should see the last changes and AI generated comments appear in the UI.
