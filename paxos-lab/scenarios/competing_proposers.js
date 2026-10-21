const Proposer =  require("../proposer");

const Acceptor = require("../acceptor");

const acceptors = [

    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")

];

const p1 = new Proposer("P1");
const p2 = new Proposer("P2");

/*
 * P1 starts first
 */

console.log("\nP1 -> Prepare(101)");

for (const a of acceptors) {
    a.prepare(101);
}

/*
 * P2 arrives with
 * higher proposal
 */

console.log("\nP2 -> Prepare(102)");

for (const a of acceptors) {

    a.prepare(102);
}

/*
 * P1 attempts accept
 */

console.log("\nP1 -> Accept(101)");

for (const a of acceptors) {

    const result =
        a.accept({
            number: 101,
            value:
            "instances=10"
        });

    console.log(
        a.id,
        result
            ? "ACCEPTED"
            : "REJECTED"
    );
}

/*
 * P2 attempts accept
 */

console.log("\nP2 -> Accept(102)");

for (const a of acceptors) {
    const result =
        a.accept({
            number: 102,
            value:
            "instances=10"
        });

    console.log(
        a.id,
        result
            ? "ACCEPTED"
            : "REJECTED"
    );
}