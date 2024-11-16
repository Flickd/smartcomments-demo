import * as vscode from 'vscode';
import 'dotenv/config';
import { ChangeTrackingService } from './ChangeTrackingService';
import { ChangeTrackerPanel } from './ChangeTrackerPanel';

export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('codeChangeTracker');
	const apiToken = config.get<string>('huggingFaceToken') || process.env.HUGGING_FACE_TOKEN;

	if (!apiToken) {
		vscode.window.showErrorMessage('Please set your Hugging Face API token in settings or environment variables.');
		return;
	}

	const changeTrackerPanel = new ChangeTrackerPanel(context.extensionUri);
	const changeTrackingService = new ChangeTrackingService(apiToken, changeTrackerPanel);

	const provider = vscode.window.registerWebviewViewProvider(
		ChangeTrackerPanel.viewType,
		changeTrackerPanel
	);

	changeTrackingService.onDidChangeFile(change => {
		changeTrackerPanel.updateChanges(changeTrackingService.getChanges());
	});

	context.subscriptions.push(
		provider,
		changeTrackingService
	);
}

export function deactivate() {}
