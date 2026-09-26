# Cerebnation

Cerebnation is a static web app and does not need a build step or package
installation. Its core, task, and neuron-name data is saved in the browser's
local storage.

## Run from VS Code

1. Open the repository folder in VS Code.
2. Choose **Terminal > Run Task...** and select **Cerebnation: Start local server**.
3. Open [http://localhost:8000](http://localhost:8000) in a browser.
4. Stop the server with **Terminal > Run Task... > Terminate Task**.

The task uses Python 3's built-in HTTP server; no extensions or dependencies
are required.
