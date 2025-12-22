import * as vscode from 'vscode';
import { FilterManager } from './FilterManager';
import { FilterItem } from '../models/Filter';

export class HighlightService {
    private decorationType: vscode.TextEditorDecorationType;

    constructor(private filterManager: FilterManager) {
        this.decorationType = this.createDecorationType();
    }

    private createDecorationType(): vscode.TextEditorDecorationType {
        const color = vscode.workspace.getConfiguration('loglens').get<string>('highlightColor') || 'rgba(255, 255, 0, 0.3)';
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
            color: 'inherit',
            fontWeight: 'bold'
        });
    }

    public refreshDecorationType() {
        this.decorationType.dispose();
        this.decorationType = this.createDecorationType();
    }

    public updateHighlights(editor: vscode.TextEditor) {
        if (!editor) {
            return;
        }

        const activeGroups = this.filterManager.getGroups().filter(g => g.isEnabled);
        const includeFilters: FilterItem[] = [];

        activeGroups.forEach(g => {
            g.filters.forEach(f => {
                if (f.type === 'include' && f.isEnabled) {
                    includeFilters.push(f);
                }
            });
        });

        if (includeFilters.length === 0) {
            editor.setDecorations(this.decorationType, []);
            return;
        }

        const text = editor.document.getText();
        const ranges: vscode.Range[] = [];

        includeFilters.forEach(filter => {
            if (!filter.keyword) {
                return;
            }
            let match;
            let regex: RegExp;

            try {
                if (filter.isRegex) {
                    regex = new RegExp(filter.keyword, 'gi');
                } else {
                    const escapedKeyword = filter.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    regex = new RegExp(escapedKeyword, 'gi');
                }

                while ((match = regex.exec(text))) {
                    const startPos = editor.document.positionAt(match.index);
                    const endPos = editor.document.positionAt(match.index + match[0].length);
                    ranges.push(new vscode.Range(startPos, endPos));
                }
            } catch (e) {
                // Ignore invalid regex for highlighting
            }
        });

        editor.setDecorations(this.decorationType, ranges);
    }

    public dispose() {
        this.decorationType.dispose();
    }
}
