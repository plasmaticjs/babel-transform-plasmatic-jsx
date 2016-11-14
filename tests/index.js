import testRunner from "babel-helper-transform-fixture-test-runner";
import path from "path";

function run (loc) {
  console.log('Running fixtures', loc)
  let name = path.basename(path.dirname(loc));
  testRunner(loc + "/fixtures", name);
}

run(__dirname);
