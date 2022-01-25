'use strict';

const APP_NAME = 'KongDash';
const VERSION = '0.3.0';

const electron = require('electron');
const path = require('path');
const ospath = require('ospath');
const jsonfile = require('jsonfile');

const ConfigManager = require('./platform/config/config-manager');

const configManager = new ConfigManager(ospath.data() + `/${APP_NAME}/v${VERSION}`);

let absPath = path.dirname(__dirname),
    configFile = ospath.data() + '/' + APP_NAME + '/config.json';
let {app, ipcMain, BrowserWindow, Menu} = electron;
let mainWindow,
    appConfig = {kong: {}, app: {enableAnimation: true}};

const connectionMap = {};

function sanitize(payload) {
    if (payload === null || typeof payload === 'undefined') {
        return {error: 'Requested entity is not available.', code: 'E404'};
    }

    return payload;
}

function startMainWindow() {
    mainWindow = new BrowserWindow({
        backgroundColor: '#1A242D',
        width: 1570,
        height: 800,
        center: true,
        title: app.getName(),
        minWidth: 1280,
        minHeight: 800,
        icon: absPath + '/kongdash-256x256.png',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile(`${absPath}/src/workbench/bootstrap.html`).then(() => {
        //* Debugging
        mainWindow.webContents.openDevTools();
        //*/
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.setName(APP_NAME);

app.on('ready', () => {
    try {
        appConfig = jsonfile.readFileSync(configFile);
    } catch (e) {
        /* Ignore. Uses default settings. */
    } finally {
        startMainWindow();
    }
});

app.on('activate', () => {
    if (mainWindow === null) startMainWindow();
});

app.on('browser-window-created', (e, window) => {
    let menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Settings',
                    click: () => {
                        mainWindow.webContents.send('open-settings-view', '');
                    }
                },
                {type: 'separator'},
                {role: 'quit'}
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'}
            ]
        },
        {
            label: 'Window',
            submenu: [{role: 'togglefullscreen'}]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'GitHub Repository',
                    click: () => {
                        electron.shell.openExternal('https://github.com/ajaysreedhar/KongDash');
                    }
                },
                {
                    label: 'Report Issues',
                    click: () => {
                        electron.shell.openExternal('https://github.com/ajaysreedhar/KongDash/issues');
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'About KongDash',
                    click: () => {
                        electron.shell.openExternal('https://ajaysreedhar.github.io/KongDash/');
                    }
                }
            ]
        }
    ];

    let menu = Menu.buildFromTemplate(menuTemplate);

    if (process.platform === 'darwin' || process.platform === 'mas') {
        Menu.setApplicationMenu(menu);
    } else {
        window.setMenu(menu);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('get-config', (event, arg) => {
    if (arg === 'VERSION') {
        event.returnValue = VERSION;
        return;
    }

    event.returnValue = appConfig[arg];
});

ipcMain.on('workbench:AsyncRequest', (event, action, payload) => {
    if (action === 'Write-Connection') {
        try {
            const connection = configManager.writeConnection(payload);
            connectionMap[`window${event.sender.id}`] = connection.id;
            event.reply('workbench:AsyncResponse', 'Write-Connection', connection);
        } catch (error) {
            event.reply('workbench:AsyncError', 'Write-Connection', {message: `${error}`});
        }
    } else {
        event.reply('workbench:AsyncError', {message: `Unknown action ${action}`});
    }
});

ipcMain.on('workbench:SyncQuery', (event, type) => {
    switch (type) {
        case 'Read-Default-Connection':
            event.returnValue = sanitize(configManager.getDefaultConnection());
            break;

        case 'Read-Session-Connection':
            event.returnValue = sanitize(configManager.getConnectionById(connectionMap[`window${event.sender.id}`]));
            break;

        default:
            event.returnValue = {error: `Unknown query type ${type}.`, code: 'E400'};
            break;
    }
});

ipcMain.on('open-external', (event, arg) => {
    electron.shell.openExternal(arg);
});
