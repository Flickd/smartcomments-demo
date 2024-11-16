import * as vscode from 'vscode';
import { LLMService } from './LLMService';
import { ChangeTrackerPanel } from './ChangeTrackerPanel';

export interface FileChange {
    fileName: string;
    timestamp: Date;
    changeType: 'modified';
    changes: {
        lineNumber: number;
        text: string;
        comment?: string;
    }[];
}

export class ChangeTrackingService {
    private changes: FileChange[] = [];
    private disposables: vscode.Disposable[] = [];
    private onChangeEmitter = new vscode.EventEmitter<FileChange>();
    private llmService: LLMService;
    private changeTrackerPanel: ChangeTrackerPanel;
    private debounceTimer: NodeJS.Timeout | undefined;

    readonly onDidChangeFile = this.onChangeEmitter.event;

    constructor(apiToken: string, changeTrackerPanel: ChangeTrackerPanel) {
        console.log('API Token:', apiToken);    
        this.llmService = new LLMService(apiToken, (status) => {
            changeTrackerPanel.updateStatus(status);
        });
        this.changeTrackerPanel = changeTrackerPanel;
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.handleFileChange.bind(this)),
            vscode.workspace.onDidSaveTextDocument(this.handleFileSave.bind(this))
        );
    }

    private handleFileChange(event: vscode.TextDocumentChangeEvent) {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new timer
        this.debounceTimer = setTimeout(() => {
            this.processFileChange(event);
        }, 1000); // Wait 1 second after last change
    }

    private async processFileChange(event: vscode.TextDocumentChangeEvent) {
        if (!event.document.fileName.endsWith('.py')) {
            return;
        }

        if (event.contentChanges.length === 0) {
            return;
        }

        console.log('File changed:', event.document.fileName);
        console.log('Content changes:', event.contentChanges);

        const textChanges = event.contentChanges.filter(change => 
            change.text.length > 0 && 
            !(change.text.length === 1 && (change.text === '' || change.text === '\n'))
        );

        if (textChanges.length === 0) {
            return;
        }

        console.log('Processing changes:', textChanges);

        const existingChange = this.changes.find(c => c.fileName === event.document.fileName);
        const lines = event.document.getText().split('\n');

        const newChanges = await Promise.all(textChanges.map(async change => {
            const lineNumber = change.range.start.line;
            const lineText = lines[lineNumber];
            console.log(`Generating comment for line ${lineNumber + 1}:`, lineText);

            try {
                const comment = await this.llmService.generateComment(lineText);
                console.log('Generated comment:', comment);
                return {
                    lineNumber,
                    text: lineText,
                    comment
                };
            } catch (error) {
                console.error('Error generating comment:', error);
                return {
                    lineNumber,
                    text: lineText,
                    comment: 'Error generating comment'
                };
            }
        }));

        if (existingChange) {
            existingChange.changes = this.mergeChanges(existingChange.changes, newChanges);
            existingChange.timestamp = new Date();
        } else {
            const change: FileChange = {
                fileName: event.document.fileName,
                timestamp: new Date(),
                changeType: 'modified',
                changes: newChanges
            };
            this.changes.push(change);
        }

        const updatedChange = this.changes.find(c => c.fileName === event.document.fileName);
        if (updatedChange) {
            console.log('Firing change event with:', updatedChange);
            this.onChangeEmitter.fire(updatedChange);
        }
    }

    private mergeChanges(existing: FileChange['changes'], newChanges: FileChange['changes']): FileChange['changes'] {
        const merged = [...existing];
        
        newChanges.forEach(newChange => {
            const existingIndex = merged.findIndex(e => e.lineNumber === newChange.lineNumber);
            if (existingIndex !== -1) {
                merged[existingIndex] = newChange;
            } else {
                merged.push(newChange);
            }
        });

        return merged.sort((a, b) => a.lineNumber - b.lineNumber);
    }

    private handleFileSave(document: vscode.TextDocument) {
        this.changes = this.changes.filter(change => change.fileName !== document.fileName);
        this.onChangeEmitter.fire({
            fileName: document.fileName,
            timestamp: new Date(),
            changeType: 'modified',
            changes: []
        });
    }

    getChanges(): FileChange[] {
        return [...this.changes];
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.onChangeEmitter.dispose();
    }
} 