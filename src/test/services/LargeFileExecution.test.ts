import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkflowManager } from '../../services/WorkflowManager';
import { ProfileManager } from '../../services/ProfileManager';
import { LogProcessor } from '../../services/LogProcessor';
import { Logger } from '../../services/Logger';
import { HighlightService } from '../../services/HighlightService';
import { SourceMapService } from '../../services/SourceMapService';
import { FilterType, FilterGroup } from '../../models/Filter';
import { Workflow } from '../../models/Workflow';

/**
 * Large File Execution Tests
 *
 * NOTE: These tests simulate behavior for large files (>50MB) without actually
 * creating huge files on disk to avoid performance overhead and CI limitations.
 * They use small placeholder files and mock logic to verify how the system
 * handles large data contexts (e.g., line padding, memory-safe processing).
 */
suite('Large File Execution Tests', () => {
    let workflowManager: WorkflowManager;
    let profileManager: ProfileManager;
    let logProcessor: LogProcessor;
    let logger: Logger;
    let highlightService: HighlightService;
    let context: vscode.ExtensionContext;

    setup(() => {
        context = {
            globalState: {
                get: (_key: string) => undefined,
                update: (_key: string, _value: unknown) => Promise.resolve(),
            },
            subscriptions: [],
            extensionUri: vscode.Uri.file('/tmp'),
            extension: { packageJSON: { version: '1.0.0' } }
        } as unknown as vscode.ExtensionContext;

        logger = { info: () => { }, error: () => { }, warn: () => { } } as unknown as Logger;
        highlightService = { registerDocumentFilters: () => { } } as unknown as HighlightService;
        profileManager = new ProfileManager(context);
        logProcessor = new LogProcessor();

        const mockSourceMapService = {
            register: () => { }
        };

        workflowManager = new WorkflowManager(
            context,
            profileManager,
            logProcessor,
            logger,
            highlightService,
            mockSourceMapService as unknown as SourceMapService
        );
    });

    test('WorkflowManager should accept Uri directly for large files', async () => {
        const workflowId = 'test-workflow';
        const largeFileUri = vscode.Uri.file('/tmp/large_file.log');

        // Mock some workflow data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (workflowManager as any).workflows = [{
            id: workflowId,
            name: 'Test Workflow',
            steps: [{ id: 'step1', profileName: 'Default' }]
        }];

        // Mock profileManager to return a profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profileManager as any).getProfileGroups = async () => [{
            id: 'g1',
            name: 'Group 1',
            filters: [{ id: 'f1', keyword: 'test', isEnabled: true, type: 'include' }]
        }];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profileManager as any).getProfileNames = () => ['Default'];

        // Mock logProcessor.processFile to succeed
        logProcessor.processFile = async (inputPath) => {
            assert.strictEqual(inputPath, largeFileUri.fsPath, 'Processor should receive the correct file path');
            return {
                outputPath: '/tmp/output.log',
                processed: 10,
                matched: 5,
                lineMapping: []
            };
        };

        // Act: Run workflow with Uri instead of TextDocument
        // This is the part we want to support
        try {
            await workflowManager.run(workflowId, largeFileUri);
            assert.ok(true, 'run() should succeed with Uri');
        } catch (e) {
            assert.fail(`run() failed with Uri: ${e}`);
        }
    });

    test('WorkflowManager should handle missing TextDocument properties gracefully when given a Uri', async () => {
        const workflowId = 'test-workflow';
        const fileUri = vscode.Uri.file('/tmp/some_file.log');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (workflowManager as any).workflows = [{
            id: workflowId,
            name: 'Test Workflow',
            steps: [{ id: 'step1', profileName: 'Default' }]
        }] as Workflow[];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profileManager as any).getProfileGroups = async () => [{
            id: 'g1',
            name: 'Group 1',
            filters: [{ id: 'f1', keyword: 'test', isEnabled: true, type: 'include' }]
        }] as FilterGroup[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profileManager as any).getProfileNames = () => ['Default'];

        logProcessor.processFile = async (_inputPath) => ({
            outputPath: '/tmp/output.log',
            processed: 10,
            matched: 5,
            lineMapping: []
        });

        // The run() method currently accesses document.uri.fsPath and document.lineCount
        // If we pass a Uri, it might crash if not handled.
        await workflowManager.run(workflowId, fileUri);

        const result = workflowManager.getLastRunResult(workflowId);
        assert.ok(result, 'Simulation result should be created');
    });

    test('Simulation of Word Filter behavior: extracting path from URI works', async () => {
        // This test documents how word filters work and confirms the processor can handle the path.
        const tempFilePath = path.join(os.tmpdir(), `large_log_from_tab_${Date.now()}.log`);
        fs.writeFileSync(tempFilePath, 'some log content\nerror line\n', 'utf8');

        const fileUri = vscode.Uri.file(tempFilePath);
        const groups = [{
            id: 'g1',
            name: 'Group 1',
            isEnabled: true,
            filters: [{ id: 'f1', keyword: 'error', isEnabled: true, type: 'include' as FilterType }]
        }];

        const filePathFromTab = fileUri.fsPath;

        try {
            const result = await logProcessor.processFile(filePathFromTab, groups, {
                prependLineNumbers: false,
                totalLineCount: 100 // Test with small content but "logic" remains same
            });
            assert.ok(result.outputPath, 'Processor should return an output path for a file path input');
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    });

    test('Workflow pipeline should continue even if intermediate result is large', async () => {
        const workflowId = 'pipeline-test';
        const tempFilePath = path.join(os.tmpdir(), `input_pipeline_${Date.now()}.log`);
        fs.writeFileSync(tempFilePath, 'log content', 'utf8');
        const fileUri = vscode.Uri.file(tempFilePath);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (workflowManager as any).workflows = [{
            id: workflowId,
            name: 'Pipeline Test',
            steps: [
                { id: 's1', profileName: 'P1' },
                { id: 's2', profileName: 'P2' }
            ]
        }] as Workflow[];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profileManager as any).getProfileGroups = async () => [{
            id: 'g1', name: 'G1', filters: [{ id: 'f1', keyword: 'test', isEnabled: true, type: 'include' }]
        }] as FilterGroup[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profileManager as any).getProfileNames = () => ['P1', 'P2'];

        let stepCount = 0;
        logProcessor.processFile = async (_inputPath) => {
            stepCount++;
            return {
                outputPath: `/tmp/step${stepCount}_output.log`,
                processed: 1000,
                matched: 500,
                lineMapping: []
            };
        };

        // Even if we can't open the intermediate result in an editor, the pipeline should continue
        // We need to make sure openStepResult doesn't throw or block if it fails to "open" the document
        try {
            await workflowManager.run(workflowId, fileUri);
            assert.strictEqual(stepCount, 2, 'Pipeline should complete all steps');
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    });

    test('Word Filter result > 50MB should be handled gracefully', async () => {
        // This test simulates a case where the result file is large.
        // We want to ensure that even if opening fails, the process itself is documented as success.
        const tempFilePath = path.join(os.tmpdir(), `input_large_result_${Date.now()}.log`);
        // We write a small amount of content but test the "large file" handling logic.
        // Creating a real 50MB+ file here would be too slow for unit tests.
        fs.writeFileSync(tempFilePath, 'log content', 'utf8');
        const fileUri = vscode.Uri.file(tempFilePath);

        const groups = [{
            id: 'g1', name: 'G1', isEnabled: true, filters: [{ id: 'f1', keyword: 'test', isEnabled: true, type: 'include' as FilterType }]
        }];

        // In CommandManager, if opening fails, it should fallback or show error but the logic remains.
        // Here we just test the processor part again with "pretending" it's large (contextual).
        try {
            const result = await logProcessor.processFile(fileUri.fsPath, groups);
            assert.ok(result.outputPath);
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    });
});
