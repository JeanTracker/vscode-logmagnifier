# Change Log

All notable changes to the "vscode-log-viewer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.0]

### Added
- **Regex Filtering**: Use regular expressions to filter logs with a dedicated side panel view.
- **Default Filters**: Included standard presets for "Logcat" and "Process Info".
- **Large File Support**: Improved handling for large filtered files with configurable size thresholds (`loglens.maxFileSizeMB`).
- **Configuration**: Added user settings for highlight colors, temp file prefixes, and status bar timeouts.

### Fixed
- **Icon Rendering**: Resolved issues with LogLens icon not appearing correctly in the Activity Bar.
- **Performance**: Disabled keyword highlighting for regex-based filters to improve performance.

## [Unreleased]

- Initial release