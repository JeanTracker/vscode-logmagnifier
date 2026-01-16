import * as vscode from 'vscode';
import { BookmarkItem } from '../models/Bookmark';

export class LogBookmarkService implements vscode.Disposable {
    private _bookmarks: Map<string, BookmarkItem[]> = new Map();
    private _onDidChangeBookmarks: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeBookmarks: vscode.Event<void> = this._onDidChangeBookmarks.event;

    private decorationType: vscode.TextEditorDecorationType;

    constructor(context: vscode.ExtensionContext) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: context.asAbsolutePath('resources/bookmark.svg'),
            gutterIconSize: 'contain',
            overviewRulerColor: 'blue',
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });

        // Listen for editor changes to update decorations
        vscode.window.onDidChangeVisibleTextEditors(editors => {
            editors.forEach(editor => this.updateDecorations(editor));
        }, null, context.subscriptions);

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.updateDecorations(editor);
            }
        }, null, context.subscriptions);

        // Listen for document close to remove bookmarks
        vscode.workspace.onDidCloseTextDocument(doc => {
            this.removeBookmarksForUri(doc.uri);
        }, null, context.subscriptions);
    }

    public addBookmark(editor: vscode.TextEditor, line: number) {
        const uri = editor.document.uri;
        const key = uri.toString();

        if (!this._bookmarks.has(key)) {
            this._bookmarks.set(key, []);
        }

        const list = this._bookmarks.get(key)!;
        // Check if already exists
        if (list.some(b => b.line === line)) {
            return;
        }

        const lineContent = editor.document.lineAt(line).text;
        const bookmark: BookmarkItem = {
            id: Date.now().toString() + Math.random().toString().slice(2),
            uri: uri,
            line: line,
            content: lineContent.trim()
        };

        list.push(bookmark);
        // Sort by line number
        list.sort((a, b) => a.line - b.line);

        this._onDidChangeBookmarks.fire();

        // Update decorations for all visible editors displaying this document
        vscode.window.visibleTextEditors.forEach(e => {
            if (e.document.uri.toString() === uri.toString()) {
                this.updateDecorations(e);
            }
        });
    }

    public removeBookmark(item: BookmarkItem) {
        const key = item.uri.toString();
        if (this._bookmarks.has(key)) {
            const list = this._bookmarks.get(key)!;
            const index = list.findIndex(b => b.id === item.id);
            if (index !== -1) {
                list.splice(index, 1);
                if (list.length === 0) {
                    this._bookmarks.delete(key);
                }
                this._onDidChangeBookmarks.fire();

                // Update decorations for all visible editors displaying this document
                vscode.window.visibleTextEditors.forEach(e => {
                    if (e.document.uri.toString() === item.uri.toString()) {
                        this.updateDecorations(e);
                    }
                });
            }
        }
    }

    public getBookmarks(): Map<string, BookmarkItem[]> {
        return this._bookmarks;
    }

    private removeBookmarksForUri(uri: vscode.Uri) {
        const key = uri.toString();
        if (this._bookmarks.has(key)) {
            this._bookmarks.delete(key);
            this._onDidChangeBookmarks.fire();
        }
    }

    public getDocumentLineCount(uri: vscode.Uri): number {
        const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        if (doc) {
            return doc.lineCount;
        }
        return 0;
    }

    private updateDecorations(editor: vscode.TextEditor) {
        const key = editor.document.uri.toString();
        if (this._bookmarks.has(key)) {
            const bookmarks = this._bookmarks.get(key)!;
            const ranges = bookmarks.map(b => new vscode.Range(b.line, 0, b.line, 0));
            editor.setDecorations(this.decorationType, ranges);
        } else {
            editor.setDecorations(this.decorationType, []);
        }
    }

    public dispose() {
        this.decorationType.dispose();
        this._onDidChangeBookmarks.dispose();
    }
}
