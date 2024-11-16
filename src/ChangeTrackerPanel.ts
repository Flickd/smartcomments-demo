import * as vscode from 'vscode';
import { FileChange } from './ChangeTrackingService';

export class ChangeTrackerPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'changeTrackerView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private _changes: FileChange[] = []
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.onDidReceiveMessage(async message => {
            console.log('Received message:', message);  // Debug log
            switch (message.command) {
                case 'accept':
                    console.log('Accepting changes for:', message.fileName);  // Debug log
                    await this.acceptChanges(message.fileName);
                    break;
                case 'decline':
                    console.log('Declining changes for:', message.fileName);  // Debug log
                    this.declineChanges(message.fileName);
                    break;
            }
        });

        this.updateContent();
    }

    private async acceptChanges(fileName: string) {
        try {
            const change = this._changes.find(c => c.fileName === fileName);
            if (!change) { return; }

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fileName));
            const edit = new vscode.WorkspaceEdit();

            const sortedChanges = [...change.changes].sort((a, b) => b.lineNumber - a.lineNumber);

            for (const lineChange of sortedChanges) {
                if (lineChange.comment) {
                    const line = document.lineAt(lineChange.lineNumber);
                    const lineEndPos = new vscode.Position(line.lineNumber, line.text.length);

                    const commentText = line.text.endsWith(' ') ? 
                        `# ${lineChange.comment}` : 
                        ` # ${lineChange.comment}`;

                    edit.insert(document.uri, lineEndPos, commentText);
                }
            }

            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                this._changes = this._changes.filter(c => c.fileName !== fileName);
                this.updateContent();
            } else {
                vscode.window.showErrorMessage('Failed to apply comments to the file.');
            }
        } catch (error) {
            console.error('Error in acceptChanges:', error);
            vscode.window.showErrorMessage('Error applying comments: ' + (error instanceof Error ? error.message : String(error)));
        }
    }

    private declineChanges(fileName: string) {
        this._changes = this._changes.filter(c => c.fileName !== fileName);
        this.updateContent();
    }

    public updateChanges(changes: FileChange[]) {
        this._changes = changes;
        this.updateContent();
    }

    private updateContent() {
        if (!this._view) {
            return;
        }
        this._view.webview.html = this._getWebviewContent(this._changes);
    }

    private _getWebviewContent(changes: FileChange[]) {
        return `<!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 10px;
                        font-size: var(--vscode-font-size);
                        line-height: 1.5;
                        margin: 0;
                    }
                    .editor-container {
                        background-color: var(--vscode-editor-background);
                        border-radius: 6px;
                        margin: 10px 0;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .file-header {
                        padding: 8px 12px;
                        background-color: var(--vscode-sideBarSectionHeader-background);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        border-radius: 6px 6px 0 0;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    .code-container {
                        padding: 8px 0;
                    }
                    .line {
                        display: flex;
                        height: 20px;
                        line-height: 20px;
                    }
                    .line-number {
                        color: var(--vscode-editorLineNumber-foreground);
                        text-align: right;
                        padding: 0 12px;
                        min-width: 40px;
                        user-select: none;
                        background-color: var(--vscode-editor-background);
                        border-right: 1px solid var(--vscode-panel-border);
                    }
                    .line-content {
                        color: var(--vscode-editor-foreground);
                        padding: 0 12px;
                        white-space: pre;
                        font-family: 'Fira Code', Consolas, 'Courier New', monospace;
                    }
                    .no-changes {
                        text-align: center;
                        color: var(--vscode-descriptionForeground);
                        padding: 20px;
                    }
                    .keyword { color: var(--vscode-symbolIcon-keywordForeground, #569cd6); }
                    .string { color: var(--vscode-symbolIcon-stringForeground, #ce9178); }
                    .comment { color: var(--vscode-symbolIcon-operatorForeground, #6a9955); }
                    .function { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
                    .number { color: var(--vscode-symbolIcon-numberForeground, #b5cea8); }
                    .line-comment {
                        color: var(--vscode-symbolIcon-operatorForeground, #6a9955);
                        padding-left: 24px;
                        font-style: italic;
                    }
                    .status-message {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        background-color: var(--vscode-editorInfo-background);
                        color: var(--vscode-editorInfo-foreground);
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-size: 12px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                        display: none;
                        z-index: 1000;
                    }
                    .status-message.visible {
                        display: block;
                    }
                    .button-container {
                        display: flex;
                        justify-content: flex-end;
                        padding: 8px 12px;
                        gap: 8px;
                        background-color: var(--vscode-sideBarSectionHeader-background);
                        border-top: 1px solid var(--vscode-panel-border);
                        border-radius: 0 0 6px 6px;
                    }
                    .button {
                        padding: 4px 8px;
                        border-radius: 3px;
                        border: 1px solid var(--vscode-button-border);
                        cursor: pointer;
                        font-size: 11px;
                    }
                    .accept-button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .decline-button {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    .button:hover {
                        opacity: 0.9;
                    }
                </style>
                <script>
                    (function() {
                        const vscode = acquireVsCodeApi();
                        
                        window.acceptChanges = function(fileName) {
                            console.log('Accept clicked for:', fileName);  // Debug log
                            vscode.postMessage({
                                command: 'accept',
                                fileName: fileName
                            });
                        };
                        
                        window.declineChanges = function(fileName) {
                            console.log('Decline clicked for:', fileName);  // Debug log
                            vscode.postMessage({
                                command: 'decline',
                                fileName: fileName
                            });
                        };

                        window.addEventListener('message', event => {
                            const message = event.data;
                            const statusElement = document.getElementById('statusMessage');
                            
                            if (message.type === 'status') {
                                if (message.isGenerating) {
                                    statusElement.textContent = \`Generating comment... (\${message.elapsedTime}s)\`;
                                    statusElement.classList.add('visible');
                                } else {
                                    statusElement.classList.remove('visible');
                                }
                            }
                        });
                    })();
                </script>
            </head>
            <body>
                <div id="statusMessage" class="status-message"></div>
                ${changes.length === 0 
                    ? '<div class="no-changes">No changes detected</div>'
                    : changes.map(change => {
                        if (!change.fileName.endsWith('.py') || change.changes.length === 0) {
                            return '';
                        }

                        const escapedFileName = change.fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        
                        return `
                            <div class="editor-container">
                                <div class="file-header">
                                    ${change.fileName.split('/').pop()}
                                </div>
                                <div class="code-container">
                                    ${change.changes.map(lineChange => `
                                        <div>
                                            <div class="line">
                                                <span class="line-number">${lineChange.lineNumber + 1}</span>
                                                <span class="line-content">${this.syntaxHighlight(this.escapeHtml(lineChange.text))}</span>
                                            </div>
                                            ${lineChange.comment ? `
                                                <div class="line">
                                                    <span class="line-number"></span>
                                                    <span class="line-comment"># ${this.escapeHtml(lineChange.comment)}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="button-container">
                                    <button class="button decline-button" 
                                        onclick="window.declineChanges('${escapedFileName}')">
                                        Decline
                                    </button>
                                    <button class="button accept-button" 
                                        onclick="window.acceptChanges('${escapedFileName}')">
                                        Accept
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
            </body>
        </html>`;
    }

    private syntaxHighlight(text: string): string {
        return text
            .replace(/\b(def|class|import|from|return|if|else|elif|for|while|try|except|with|as|in|is|not|and|or|True|False|None)\b/g, 
                '<span class="keyword">$1</span>')
            .replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$1</span>')
            .replace(/(".*?"|'.*?')/g, '<span class="string">$1</span>')
            .replace(/(#.*)$/g, '<span class="comment">$1</span>')
            .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*(?=\s*\(\)))/g, '<span class="function">$1</span>');
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    public updateStatus(status: { isGenerating: boolean; elapsedTime: number }) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'status',
                ...status
            });
        }
    }
} 