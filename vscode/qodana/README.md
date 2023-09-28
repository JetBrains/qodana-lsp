# Qodana VSCode extension
​
[![GitHub Discussions](https://img.shields.io/github/discussions/jetbrains/qodana)]
[![Twitter Follow](https://img.shields.io/twitter/follow/Qodana?style=social&logo=twitter)]
​
This extension connects to Qodana Cloud and showcases the latest code quality issues for your project.
​
## Prerequisites
​
Before utilizing the extension, please ensure you fulfill the following prerequisites:
​
1. You have a Qodana Cloud account. If not, please create one [here](https://qodana.cloud/).
2. You have a project set up on Qodana Cloud. If not, please create one [here](https://qodana.cloud/).
3. The source code of this project has been downloaded to your local machine and is opened in a VS Code workspace
4. You have run the Qodana analysis for your project at least once and generated a report in your Qodana Cloud project.
5. There is a Java binary on your system path (JRE 11 or higher is required). You can check it by running the command "java -version" in the Terminal.
​
## Installation and Configuration
​
1. Open your project as a Workspace in VS Code, make sure your VS Code window is a top most among other VS Code windows.
2. Open Qodana Cloud, navigate to your project and click "Open in VSCode" button from the dropdown selector under any issue found in the project.
3. You will be prompted to authenticate with Qodana Cloud. Once authorized, the extension will be set and ready for use.

Alternatively:
1. Open your Workspace settings: go to Code > Settings > Settings and choose the Workspace tab, select Qodana extension.
2. Enter the Qodana Cloud project ID into the "Project ID" field. To locate this ID, open your project in Qodana Cloud; the URL will have the following format: `https://qodana.cloud/projects/PROJECT_ID/reports/REPORT_ID`.
3. You will be prompted to authenticate with Qodana Cloud. Once authorized, the extension will be set and ready for use.

If you don't see any issues from the report after successfully loading it, adjust the "Path Prefix" field in Settings.
The rule is: `"Full Path" = "Workspace" + "Path Prefix" + "Path in SARIF"`

Here are examples how to define the correct path prefix:
​
| Full Path         | Path in SARIF    | Workspace        | Path Prefix      |
|-------------------|------------------|------------------|------------------|
| /foo/bar/baz/file | baz/file         | /foo/bar         | (empty, no value)|
| /foo/bar/baz/file | baz/file         | /foo/bar/baz     | ..               |
| /foo/bar/baz/file | file             | /foo/bar         | baz              |
​
You can refer to the Qodana Cloud report (within the Files section beneath the sunburst diagram) to see how the "Path in SARIF" is set.
​
​
## Usage
​
Once the project is set up, it will synchronize with Qodana Cloud. If there are any issues found by Qodana analysis, they will be displayed in the file list and under the Problems view (View > Problems).
​
To stop receiving new reports from Qodana Cloud, use the command `Qodana: Reset authentication`.
To reset the extension settings, use the command `Qodana: Reset settings`.
To temporarily disable the extension, click on Qodana item in the status bar, so that it turns yellow.

Feel free to commit .vscode/settings.json to your repository to share the Qodana integration settings with your team!

## Qodana Extension Telemetry

Qodana VS Code extension is enhanced with telemetry functionality, aimed at collecting valuable data on how you use the extension. Importantly, no project-specific or personal data is collected as part of this telemetry. The items logged, which exclusively use predefined string literals, include the following events:

- **Extension Start and Stop**

- **Opening the Report from Qodana Cloud**

- **Opening a File Using URL from Qodana Cloud**

- **Settings Reset**

- **Turning Off/On Displaying the Issues from Qodana Cloud**

- **Predefined Error Messages**

The telemetry information increases the efficiency of the extension by availing usage data for improvements. Logging is performed using the recommended API by the [extension authors guide](https://code.visualstudio.com/api/extension-guides/telemetry).

Respecting your privacy, we provide the option to opt-out of telemetry data collection. You can revoke consent by uninstalling the Qodana Cloud VS Code extension or switching the `telemetry.telemetryLevel` setting in VS Code to *off*.

This information helps us understand your needs better to enhance the functionality and user experience of the Qodana Cloud VS Code extension, while keeping your data private and secure. Your feedback is always appreciated!

​
## Questions, issues, or feedback?
​
All issues, feature requests, and support inquiries related to Qodana are managed at: [YouTrack][youtrack].
​
To file a new issue, please follow this link: [YouTrack | New Issue][youtrack-new-issue]. Additionally, you can use [GitHub Discussions][jb:discussions] to pose questions or provide feedback.
​
[gh:qodana]: https://github.com/JetBrains/qodana-action/actions/workflows/code_scanning.yml
[youtrack]: https://youtrack.jetbrains.com/issues/QD
[youtrack-new-issue]: https://youtrack.jetbrains.com/newIssue?project=QD&c=Platform%20GitHub%20action
[jb:confluence-on-gh]: https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub
[jb:discussions]: https://jb.gg/qodana-discussions
[jb:twitter]: https://twitter.com/Qodana
[jb:docker]: https://hub.docker.com/r/jetbrains/qodana