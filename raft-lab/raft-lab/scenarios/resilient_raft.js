const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const Node = require("../node");
const Cluster = require("../cluster");
const Network = require("../network");
const HardenedSimulator = require("../hardenedSimulator");

async function main() {
    // Advance election time explicitly so the demonstration finishes quickly.
    // Message processing uses real elapsed time, including the injected delay.
    let time = 0;
    let slow = false;
    const nodes = [new Node("A"), new Node("B"), new Node("C")];
    const [a, b, c] = nodes;
    const network = new Network();
    const runtime = path.join(__dirname, "..", "runtime");
    fs.mkdirSync(runtime, { recursive: true });
    const stateDirectory = fs.mkdtempSync(path.join(runtime, "part10-"));
    const options = { now: () => time, random: () => 0, stateDirectory,
        slowMessageMs: 10,
        processMessage: async ({ to, signal }) => {
            if (slow && to === "C") await delay(25, undefined, { signal });
        } };
    const simulator = new HardenedSimulator(new Cluster(nodes), network, options);
    const waitElection = () => { time += simulator.electionTimeoutMs; };

    console.log("\nPART 10: NORMAL ELECTION AND REPLICATION");
    waitElection();
    assert.equal(await simulator.electLeader(a), true);
    assert.equal(await simulator.replicate("instances=10"), true);
    await simulator.heartbeat();

    console.log("\nSLOW MESSAGE PROCESSING");
    slow = true;
    await simulator.heartbeat();
    slow = false;
    assert.ok(simulator.health().metrics.slowMessages > 0);

    console.log("\nREPEATED LEADER FAILURES: TIMEOUT 300 -> 600 -> 1200");
    a.fail();
    waitElection();
    assert.equal(await simulator.electLeader(b), true);
    a.recover();
    b.fail();
    waitElection();
    assert.equal(await simulator.electLeader(c), false);
    assert.equal(simulator.electionTimeoutMs, 600);
    const termBefore = c.currentTerm;
    assert.equal(await simulator.electLeader(c), false);
    assert.equal(c.currentTerm, termBefore);
    waitElection();
    assert.equal(await simulator.electLeader(c), true);
    b.recover();
    c.fail();
    waitElection();
    assert.equal(await simulator.electLeader(a), true);
    c.recover();
    a.fail();
    waitElection();
    assert.equal(await simulator.electLeader(b), false);
    assert.equal(simulator.electionTimeoutMs, 1200);
    a.recover();
    waitElection();
    assert.equal(await simulator.electLeader(b), true);
    await simulator.heartbeat();

    console.log("\nNETWORK DISCONNECTION: SAVE LOGS AND STOP SENDING");
    network.partition();
    await simulator.tick();
    const messagesBefore = simulator.health().metrics.messages;
    const stateBefore = simulator.snapshot();
    assert.equal(await simulator.replicate("blocked-command"), false);
    assert.equal(await simulator.heartbeat(), false);
    assert.equal(await simulator.electLeader(a), false);
    assert.equal(simulator.health().metrics.messages, messagesBefore);
    assert.deepEqual(simulator.snapshot(), stateBefore);
    console.log("CHECK PASSED: no new messages, log entries, or commits during disconnection");

    console.log("\nRECONNECT AND RE-ELECT");
    network.repair();
    assert.equal(await simulator.replicate("still-blocked"), false);
    assert.equal(await simulator.resume(), true);
    waitElection();
    assert.equal(await simulator.electLeader(b), true);
    c.fail();
    assert.equal(await simulator.replicate("instances=20"), true);
    console.log("Follower lag:", simulator.health().nodes);
    c.recover();
    await simulator.heartbeat();
    assert.deepEqual(a.log, c.log);

    console.log("\nPROCESS RESTART: VALIDATE AND RESTORE STATE");
    const recoveredNodes = [new Node("A"), new Node("B"), new Node("C")];
    const recovered = new HardenedSimulator(new Cluster(recoveredNodes), new Network(), options);
    assert.equal(recovered.health().leader, null);
    assert.equal(recovered.health().suspended, true);
    assert.deepEqual(recoveredNodes[0].log, a.log);
    assert.equal(recovered.electionTimeoutMs, 1200);
    await recovered.resume();
    time += recovered.electionTimeoutMs;
    assert.equal(await recovered.tick(), true);
    await recovered.heartbeat();
    console.log("\nFINAL HEALTH:", JSON.stringify(recovered.health(), null, 2));
    console.log(`\nState and audit logs: ${stateDirectory}`);
    console.log("ALL DEMONSTRATION CHECKS PASSED");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
