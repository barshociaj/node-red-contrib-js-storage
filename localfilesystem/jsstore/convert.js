/**
 * Convert each node JSON in Node-RED flows file to/from individual JS files in CommonJS
 *
 * A. json2js converts json to js:
 *   1. Export JSON without multiline and function strings as const Node = ...
 *   2. Extract multiline strings as template literals e.g. Node.info = ... (attributes: info, template)
 *   3. Extract function strings as javascript functions e.g. Node.func = ... (attributes: initialize, func, finalize)
 *
 * B. js2json converts the js back to json
 *
 * See test file for an example
 **/

const fs = require("fs-extra");
const fspath = require("path");
const vm = require("vm");

const storageExtension = ".flows.js";
const logPrefix = "node-red-contrib-js-storage: ";

const nodePrefix = `const Node = `;
const nodeSuffix = `module.exports = Node;`;
const funcIndent = "  ";
const funcParameters = [
  "node",
  "msg",
  "RED",
  "context",
  "flow",
  "global",
  "env",
  "util",
];
const funcPrefix = (name, params) =>
  `Node.${name} = async function (${params.join(", ")}) {`;
const funcSuffix = "}";
const textPrefix = (name) => `Node.${name} = ` + "`\n";
const textSuffix = "\n`";

// textEscapes are characters that must be escaped in a template literal
const textEscapes = {
  "`": "\\`",
  "\\": "\\\\",
  $: "\\$",
};

// textAsTemplateLiteral escapes text to form the body of template literal
function textAsTemplateLiteral(txt) {
  let out = "";
  for (const c of txt) {
    out += textEscapes[c] || c;
  }
  return out;
}

// ConvertNode is added and executed inside the js file to extract Node JSON with functions as strings
function ConvertNode(jsstore) {
  const funcIndent = "  "; // Re-define for vm
  const outdent = (code) => {
    const lines = code.split("\n");
    let out = [];
    for (let line of lines) {
      if (line.startsWith(funcIndent)) {
        out.push(line.substring(funcIndent.length));
      } else {
        if (line.length > 0) {
          out = lines; // skip outdenting, format has been changed
          break;
        }
      }
    }
    return out.join("\n");
  };
  const getBody = (s) => s.substring(s.indexOf("{") + 1, s.lastIndexOf("}"));

  for (let fn of ["initialize", "func", "finalize"]) {
    if (typeof Node[fn] === "function") {
      Node[fn] = outdent(getBody(Node[fn].toString()));
    }
  }

  // Remove first and last char (newline) from template literals
  for (let txt of ["info", "template"]) {
    if (Node[txt] && Node[txt] !== "") {
      console.log("REMOVING:", Node[txt]);
      Node[txt] = Node[txt].slice(1, -1);
      console.log("....TO:", Node[txt]);
    }
  }

  jsstore.Node = Node;
}

// js2json creates Node-RED node object out of js file contents
function js2json(data) {
  const context = { jsstore: {}, module: {} };
  vm.createContext(context);
  const getNode = "\n" + ConvertNode.toString() + "ConvertNode(jsstore);";
  vm.runInContext(data + getNode, context);
  return context.jsstore.Node;
}

// json2js returns js file contents and the filename (where filename is the type + node id + .flows.js extension) out of Node-RED node object
function json2js(json) {
  const separator = "\n\n";

  // Add libraries to the list of default function parameters
  const fnParams = funcParameters.slice();
  if (json.hasOwnProperty("libs")) {
    for (let lib of json.libs) {
      if (lib.hasOwnProperty("var")) {
        fnParams.push(lib.var);
      }
    }
  }

  const extracted = [];

  // Extract info and template as template literals
  for (let txt of ["info", "template"]) {
    if (json.hasOwnProperty(txt) && json[txt] !== "") {
      let prefix = textPrefix(txt);
      let code = prefix + textAsTemplateLiteral(json[txt]) + textSuffix;
      extracted.push(code);
      json[txt] = ""; // preserves position in object to keep same hash
    }
  }

  // Extract function scripts
  for (let fn of ["initialize", "func", "finalize"]) {
    if (json.hasOwnProperty(fn) && json[fn] !== "") {
      let code = indent(json[fn]);
      let prefix = funcPrefix(fn, fnParams);
      code = prefix + "\n" + code + "\n" + funcSuffix;
      extracted.push(code);
      json[fn] = ""; // preserves position in object to keep same hash
    }
  }

  // Sanitize json type for file name
  const safeType = json.type.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  // Return js code and file name
  return [
    nodePrefix +
      JSON.stringify(json, null, 2) +
      (extracted.length > 0 ? separator : "") +
      extracted.join(separator) +
      separator +
      nodeSuffix,
    safeType + "." + json.id + storageExtension,
  ];
}

// indent indents function code with 2 spaces
function indent(code) {
  return code
    .split("\n")
    .map((line) => funcIndent + line)
    .join("\n");
}

// readJSONArrayFromJSFiles reads dirPath and returns JSON array from .flows.js files
function readJSONArrayFromJSFiles(dirPath, emptyResponse) {
  let out = [];
  try {
    const files = fs.readdirSync(dirPath);
    for (let fileName of files) {
      const data = fs.readFileSync(fspath.join(dirPath, fileName));
      out.push(js2json(data));
    }
    // Keep order to ensure flows hash is equal with UI
    out.sort((a, b) => a._order - b._order);
    out = out.map((n) => {
      delete n._order;
      return n;
    });
    if (out.length === 0) {
      return emptyResponse;
    }
  } catch (e) {
    console.warn(logPrefix + "Invalid file", e.message);
    return emptyResponse;
  }
  return out;
}

// writeJSONArrayToJSFiles creates .flows.js files in dirPath directory out of content (JSON array)
async function writeJSONArrayToJSFiles(dirPath, content) {
  const fileNames = [];
  const contentClone = JSON.parse(JSON.stringify(content));
  let order = 0;
  try {
    for (let json of contentClone) {
      // Keep order to ensure flows hash is equal with UI
      json._order = order++;
      const [data, fileName] = json2js(json);
      fileNames.push(fileName);
      const stream = fs.createWriteStream(fspath.join(dirPath, fileName));
      await new Promise((res) => stream.write(data, res));
      await new Promise((res) => stream.end(res));
    }
  } catch (e) {
    throw new Error(`${logPrefix}Failed saving to ${dirPath} (${e.message})`);
  }

  // Remove extra .flows.js files in the directory
  try {
    const files = fs.readdirSync(dirPath);
    for (let fileName of files) {
      if (
        fileName.endsWith(storageExtension) &&
        !fileNames.includes(fileName)
      ) {
        fs.unlinkSync(fspath.join(dirPath, fileName));
      }
    }
  } catch (e) {
    throw new Error(`${logPrefix}Failed cleaning up old files (${e.message})`);
  }
}

module.exports = {
  readJSONArrayFromJSFiles,
  writeJSONArrayToJSFiles,

  // test exports
  _js2json: js2json,
  _json2js: json2js,
  _storageExtension: storageExtension,
};
