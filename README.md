# OpenCircuit SPICE Parser

Dependency-free SPICE netlist parsing, serialization and OpenCircuit conversion for Node.js and browsers.

Supported elements: resistors, capacitors, inductors, independent DC voltage/current sources and diodes. The parser understands engineering suffixes, comments, continuation lines, directives and diode parameters. Unsupported constructs produce line-numbered diagnostics.

```js
import { parseSpice, toOpenCircuit } from '@opencircuitlabs/spice-parser';
const circuit = toOpenCircuit(parseSpice('Demo\nV1 in 0 5\nR1 in 0 1k\n.end'));
```

Run `npm test`. MIT licensed.
