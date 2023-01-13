/**
 * Node-RED source: https://github.com/node-red/node-red/blob/master/packages/node_modules/%40node-red/runtime/lib/storage/localfilesystem/projects/index.js
 * ... modified to provide getFlows and saveFlows that create individual js files per node instead of flows.json + support flowFile and flowDir from settings
 * ... removed @node-red/util log
 *
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var fs = require("fs-extra");
var fspath = require("path");

var util = require("../util");
var convert = require("./convert");

var settings;

// storageDirectorySuffix is added by default to the flows file base name to form the name of the directory that holds js files
const storageDirectorySuffix = "_js";

var initialFlowLoadComplete = false;

var flowsFile;
var flowsFullPath;
var flowsFileBackup;

var flowsDir;
var flowsDirFullPath;

var credentialsFile;
var credentialsFileBackup;

function init(_settings, _runtime) {
  settings = _settings;
  runtime = _runtime;

  if (settings.editorTheme?.projects?.enabled === true) {
    throw new Error("node-red-contrib-js-store does not support projects");
  }

  if (settings.flowFile) {
    flowsFile = settings.flowFile;
    // handle Unix and Windows "C:\" and Windows "\\" for UNC.
    if (fspath.isAbsolute(flowsFile)) {
      // Absolute path
      flowsFullPath = flowsFile;
    } else if (flowsFile.substring(0, 2) === "./") {
      // Relative to cwd
      flowsFullPath = fspath.join(process.cwd(), flowsFile);
    } else {
      try {
        fs.statSync(fspath.join(process.cwd(), flowsFile));
        // Found in cwd
        flowsFullPath = fspath.join(process.cwd(), flowsFile);
      } catch (err) {
        // Use userDir
        flowsFullPath = fspath.join(settings.userDir, flowsFile);
      }
    }
  } else {
    flowsFile = "flows_" + require("os").hostname() + ".json";
    flowsFullPath = fspath.join(settings.userDir, flowsFile);
    usingHostName = true;
  }
  var ffExt = fspath.extname(flowsFullPath);
  var ffBase = fspath.basename(flowsFullPath, ffExt);

  flowsFileBackup = getBackupFilename(flowsFullPath);
  credentialsFile = fspath.join(settings.userDir, ffBase + "_cred" + ffExt);
  credentialsFileBackup = getBackupFilename(credentialsFile);

  // Store js files in settings.flowDir or flows + storageDirectorySuffix (flows_js) by default
  if (settings.flowDir) {
    flowsDir = settings.flowDir;
  } else {
    flowsDir = ffBase + storageDirectorySuffix;
  }
  flowsDirFullPath = fspath.join(settings.userDir, flowsDir);

  // Create js file directory if one does not exist
  if (!fs.existsSync(flowsDirFullPath)) {
    fs.mkdirSync(flowsDirFullPath);
  }

  return Promise.resolve();
}

function getBackupFilename(filename) {
  var ffName = fspath.basename(filename);
  var ffDir = fspath.dirname(filename);
  return fspath.join(ffDir, "." + ffName + ".backup");
}

async function getFlows() {
  if (!initialFlowLoadComplete) {
    initialFlowLoadComplete = true;
    //console.info("storage.localfilesystem.user-dir", {path: settings.userDir});
    //console.info("storage.localfilesystem.flows-file", { path: flowsFullPath });
  }

  // Read JSON from JS files
  let flows = await convert.readJSONArrayFromJSFiles(flowsDirFullPath, null);

  // If files do not exist, fail back to flows.json file (or backup file)
  if (flows === null) {
    flows = await util.readFile(flowsFullPath, flowsFileBackup, null, "flow");
    if (flows === null) {
      return [];
    }
  }

  return flows;
}

async function saveFlows(flows, user) {
  if (settings.readOnly) {
    return;
  }

  var flowData;

  if (settings.flowFilePretty) {
    // Pretty format if option enabled, or using Projects and not explicitly disabled
    flowData = JSON.stringify(flows, null, 4);
  } else {
    flowData = JSON.stringify(flows);
  }

  // Keep flows.json file as backup or for code sharing - unless turned off via `flowFile: false` setting
  console.log(
    "debug: settings.flowFile",
    typeof settings.flowFile,
    settings.flowFile,
    settings.flowFile !== false
  );
  if (settings.flowFile !== false) {
    await util.writeFile(flowsFullPath, flowData, flowsFileBackup);
  }

  // Store JSON as JS files
  await convert.writeJSONArrayToJSFiles(flowsDirFullPath, flows);
}

function getCredentials() {
  return util.readFile(
    credentialsFile,
    credentialsFileBackup,
    {},
    "credentials"
  );
}

async function saveCredentials(credentials) {
  if (settings.readOnly) {
    return;
  }

  var credentialData;
  if (settings.flowFilePretty) {
    // Pretty format if option enabled, or using Projects and not explicitly disabled
    credentialData = JSON.stringify(credentials, null, 4);
  } else {
    credentialData = JSON.stringify(credentials);
  }
  return util.writeFile(credentialsFile, credentialData, credentialsFileBackup);
}

module.exports = {
  init: init,
  getFlows: getFlows,
  saveFlows: saveFlows,
  getCredentials: getCredentials,
  saveCredentials: saveCredentials,
};
