const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable GPU acceleration (common fix for Windows crashes)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Log crashes to file
function logCrash(msg) {
    try {
        fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), new Date().toISOString() + ' ' + msg + '\n');
    } catch (e) {}
}

process.on('uncaughtException', (err) => {
    logCrash('Uncaught: ' + (err && err.message ? err.message : err) + ' ' + (err && err.stack ? err.stack : ''));
});

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#1c1c26',
            symbolColor: '#eeecf5',
            height: 32
        },
        show: false,
        backgroundColor: '#13131b'
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        logCrash('Window shown');
    });

    mainWindow.on('closed', () => { mainWindow = null; });

    mainWindow.webContents.on('crashed', (event, killed) => {
        logCrash('Renderer crashed. Killed: ' + killed);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        logCrash('Failed to load: ' + errorCode + ' ' + errorDescription);
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    logCrash('Window loading...');
}

app.whenReady().then(() => {
    logCrash('App ready');
    Menu.setApplicationMenu(null);
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
