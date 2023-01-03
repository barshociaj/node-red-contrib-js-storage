const {
  _js2json,
  _json2js,
  _PREFIX,
  _storageExtension,
} = require("./convert.js");
const { diff } = require("jest-diff");

const node = {
  id: "c0bd346c54d153d9",
  type: "function",
  z: "66d84716f9f936a2",
  name: "function abc",
  outputs: 2,
  noerr: 0,
  initialize:
    "// Code added here will be run once\n// whenever the node is started.\nconsole.log('int')",
  finalize:
    "// Code added here will be run when the\n// node is being stopped or re-deployed.\nconsole.log('fin')",
  func: "return msg;",
  libs: [
    {
      var: "moment",
      module: "moment",
    },
  ],
  x: 520,
  y: 320,
  wires: [[], []],
  info: 'const a = "b" escaped\n${extra} escaped\n`${variable}` escaped\n\\n not new line',
};

const code = `const Node = {
  "id": "c0bd346c54d153d9",
  "type": "function",
  "z": "66d84716f9f936a2",
  "name": "function abc",
  "outputs": 2,
  "noerr": 0,
  "initialize": "",
  "finalize": "",
  "func": "",
  "libs": [
    {
      "var": "moment",
      "module": "moment"
    }
  ],
  "x": 520,
  "y": 320,
  "wires": [
    [],
    []
  ],
  "info": ""
}

Node.info = ${"`"}
const a = "b" escaped
${"\\"}\${extra} escaped
${"\\"}${"`"}${"\\"}\${variable}${"\\"}${"`"} escaped
${"\\"}${"\\"}n not new line
${"`"}

Node.initialize = async function (node, msg, RED, context, flow, global, env, util, moment) {
  // Code added here will be run once
  // whenever the node is started.
  console.log('int')
}

Node.func = async function (node, msg, RED, context, flow, global, env, util, moment) {
  return msg;
}

Node.finalize = async function (node, msg, RED, context, flow, global, env, util, moment) {
  // Code added here will be run when the
  // node is being stopped or re-deployed.
  console.log('fin')
}

module.exports = Node;`;

/* Node.info translates into the following expected template literal:
Node.info = `
const a = "b" escaped
\${extra} escaped
\`\${variable}\` escaped
\\n not new line
`
*/

test("node json should be converted to js", () => {
  const json = JSON.parse(JSON.stringify(node));
  const [result, id] = _json2js(json);
  console.log(diff(code, result));
  expect(result).toEqual(code);
  expect(id).toEqual(json.type + "." + json.id + _storageExtension);
});

test("js should be converted to node json", () => {
  const json = JSON.parse(JSON.stringify(node));
  const result = _js2json(code);
  console.log(diff(json, result));
  expect(result).toEqual(json);
});
