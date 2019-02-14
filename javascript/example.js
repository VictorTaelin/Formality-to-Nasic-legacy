const formality = require("formality-lang");
const compiler = require(".");

var defs = formality.parse(`
// Church-encoded Nat 3
3 = [succ] [zero] (succ (succ (succ zero)))

// Church-encoded Nat exponentiation
exp = [a] [b] (b a)

main = (exp 3 3)
`);

var term = defs.main.term;

console.log("Input term:");
console.log(formality.show(term));
console.log("");

console.log("Normal form (interpreted):");
console.log(formality.show(formality.norm(term, defs, true)));
console.log("");

console.log("Normal form (via Nasic compilation):");
var {norm, stats} = compiler.norm_with_stats(term, defs);
console.log(formality.show(norm));
console.log("");

console.log("Stats:");
console.log(stats);
