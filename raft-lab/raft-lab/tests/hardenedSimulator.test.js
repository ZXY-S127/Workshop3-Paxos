const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const Node = require("../node");
const Cluster = require("../cluster");
const Network = require("../network");
const StateStore = require("../stateStore");
const HardenedSimulator = require("../hardenedSimulator");

function setup(t, overrides = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raft-hardening-test-"));
    t.after(() => {
        const resolved = fs.realpathSync(directory);
        const root = fs.realpathSync(os.tmpdir());
        if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith("raft-hardening-test-")) {
            throw new Error("Refusing cleanup outside the test directory");
        }
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    let time = 0;
    const nodes = [new Node("A"), new Node("B"), new Node("C")];
    const network = new Network();
    const messages = [];
    network.send = message => {
        messages.push(message);
        return !network.partitioned;
    };
    const events = [];
    const options = { now: () => time, random: () => 0, stateDirectory: directory,
        output: line => events.push(line), ...overrides };
    const simulator = new HardenedSimulator(new Cluster(nodes), network, options);
    return { simulator, nodes, network, messages, events, directory, options,
        advance: (ms = simulator.electionTimeoutMs) => { time += ms; } };
}

async function elect(f, node = f.nodes[0]) {
    f.advance();
    assert.equal(await f.simulator.electLeader(node), true);
}

test("healthy heartbeats prevent elections and replication commits with a quorum", async t => {
    const f = setup(t);
    assert.equal(await f.simulator.electLeader(f.nodes[0]), false);
    await elect(f);
    assert.equal(await f.simulator.replicate("x=1"), true);
    await f.simulator.heartbeat();
    for (let i = 0; i < 8; i++) {
        f.advance(100);
        await f.simulator.tick();
    }
    assert.equal(f.simulator.health().metrics.elections, 1);
    assert.ok(f.nodes.every(node => node.commitIndex === 1));
    assert.deepEqual(f.nodes[0].log, f.nodes[2].log);
    assert.notEqual(f.nodes[0].log[0], f.nodes[2].log[0]);
});

test("each churn incident doubles the timeout and actually blocks new elections", async t => {
    const f = setup(t);
    const [a, b, c] = f.nodes;
    await elect(f, a);
    a.online = false;
    await elect(f, b);
    a.online = true;
    b.online = false;
    f.advance();
    assert.equal(await f.simulator.electLeader(c), false);
    assert.equal(f.simulator.electionTimeoutMs, 600);
    const term = c.currentTerm;
    const sends = f.messages.length;
    for (let i = 0; i < 10; i++) assert.equal(await f.simulator.electLeader(c), false);
    assert.equal(c.currentTerm, term);
    assert.equal(f.messages.length, sends);
    assert.equal(f.simulator.electionTimeoutMs, 600);
    await elect(f, c);
    b.online = true;
    c.online = false;
    await elect(f, a);
    c.online = true;
    a.online = false;
    f.advance();
    assert.equal(await f.simulator.electLeader(b), false);
    assert.equal(f.simulator.electionTimeoutMs, 1200);
    assert.equal(f.simulator.metrics.churnIncidents, 2);
    a.online = true;
    assert.equal(f.simulator.leader(), undefined);
    await elect(f, b);
    assert.equal(f.simulator.leader().id, "B");
});

test("old elections expire from the churn window", async t => {
    const f = setup(t, { churnWindowMs: 500 });
    await elect(f);
    for (let i = 0; i < 4; i++) {
        const leader = f.simulator.leader();
        leader.online = false;
        f.advance(1000);
        // Select a current-term follower; a just-recovered node may first need term catch-up.
        const candidate = f.nodes.filter(node => node.online)
            .sort((a, b) => b.currentTerm - a.currentTerm)[0];
        assert.equal(await f.simulator.electLeader(candidate), true);
        leader.online = true;
    }
    assert.equal(f.simulator.metrics.churnIncidents, 0);
});

test("partition saves state, removes leadership and prevents all protocol sends", async t => {
    const f = setup(t);
    await elect(f);
    await f.simulator.replicate("saved=1");
    await f.simulator.heartbeat();
    const before = f.simulator.snapshot();
    f.network.partitioned = true;
    await f.simulator.tick();
    const sends = f.messages.length;
    assert.equal(await f.simulator.replicate("unsafe=1"), false);
    assert.equal(await f.simulator.heartbeat(), false);
    f.advance(10000);
    assert.equal(await f.simulator.electLeader(f.nodes[1]), false);
    assert.equal(await f.simulator.resume(), false);
    assert.equal(f.messages.length, sends);
    assert.equal(f.simulator.leader(), undefined);
    assert.deepEqual(f.simulator.store.load(), before);
    assert.match(fs.readFileSync(path.join(f.directory, "audit.jsonl"), "utf8"), /NETWORK_DISCONNECTED/);
    f.network.partitioned = false;
    assert.equal(await f.simulator.replicate("still-unsafe=1"), false);
    await f.simulator.resume();
    assert.equal(await f.simulator.electLeader(f.nodes[0]), false);
    await elect(f);
    assert.equal(await f.simulator.replicate("safe=2"), true);
});

test("no majority blocks election and appending before sending any messages", async t => {
    const f = setup(t);
    await elect(f);
    f.nodes[1].online = false;
    f.nodes[2].online = false;
    const sends = f.messages.length;
    assert.equal(await f.simulator.replicate("unsafe=1"), false);
    assert.equal(f.messages.length, sends);
    assert.equal(f.nodes[0].log.length, 0);
    assert.equal(f.simulator.reason, "NO_MAJORITY");
});

test("a dropped request cannot mutate followers or count as an acknowledgement", async t => {
    const f = setup(t);
    await elect(f);
    let attempts = 0;
    f.network.send = () => { attempts++; return false; };
    assert.equal(await f.simulator.replicate("uncommitted=1"), false);
    assert.equal(attempts, 1);
    assert.equal(f.nodes[0].log.length, 1);
    assert.equal(f.nodes[1].log.length, 0);
    assert.ok(f.nodes.every(node => node.commitIndex === 0));
    await f.simulator.heartbeat();
    assert.equal(attempts, 1);
});

test("a lost ACK leaves the entry durable but uncommitted", async t => {
    const f = setup(t);
    await elect(f);
    f.network.send = message => !message.includes(" ACK ");
    assert.equal(await f.simulator.replicate("pending=1"), false);
    const state = f.simulator.store.load();
    assert.equal(state.nodes[1].log.length, 1);
    assert.ok(state.nodes.every(node => node.commitIndex === 0));
    assert.equal(f.simulator.reason, "ACK_DELIVERY_FAILED");
});

test("slow processing is measured and recorded", async t => {
    const f = setup(t, { slowMessageMs: 5 });
    await elect(f);
    f.simulator.processMessage = async () => delay(15);
    assert.equal(await f.simulator.heartbeat(), true);
    assert.ok(f.simulator.metrics.slowMessages >= 2);
    assert.ok(f.simulator.metrics.maxProcessingMs >= 10);
    assert.ok(f.events.some(event => event.startsWith("SLOW_MESSAGE")));
});

test("timed-out handlers cannot later append entries or send ACKs", async t => {
    const f = setup(t);
    await elect(f);
    f.simulator.rpcTimeoutMs = 10;
    f.simulator.processMessage = () => delay(45);
    assert.equal(await f.simulator.replicate("late=1"), false);
    const sends = f.messages.length;
    await delay(70);
    assert.equal(f.messages.length, sends);
    assert.equal(f.nodes[1].log.length, 0);
    assert.equal(f.simulator.metrics.timedOutMessages, 1);
    assert.equal(f.simulator.reason, "MESSAGE_TIMEOUT");
});

test("a partition during processing is detected before the log is changed", async t => {
    const f = setup(t);
    await elect(f);
    f.simulator.processMessage = async () => { f.network.partitioned = true; };
    assert.equal(await f.simulator.replicate("lost=1"), false);
    assert.equal(f.nodes[1].log.length, 0);
    assert.equal(f.nodes[0].commitIndex, 0);
});

test("minority failure allows commits and the recovered follower catches up", async t => {
    const f = setup(t);
    await elect(f);
    f.nodes[2].online = false;
    assert.equal(await f.simulator.replicate("x=1"), true);
    assert.equal(f.simulator.health().nodes[2].lag, 1);
    f.nodes[2].online = true;
    await f.simulator.heartbeat();
    assert.deepEqual(f.nodes[2].log, f.nodes[0].log);
    assert.equal(f.nodes[2].commitIndex, 1);
});

test("a stale candidate is rejected; failed elections trigger storm protection", async t => {
    const f = setup(t);
    await elect(f);
    f.nodes[2].online = false;
    await f.simulator.replicate("x=1");
    await f.simulator.heartbeat();
    f.nodes[2].online = true;
    f.nodes[0].online = false;
    f.advance();
    assert.equal(await f.simulator.electLeader(f.nodes[2]), false);
    assert.equal(f.simulator.leader(), undefined);
    f.advance();
    assert.equal(await f.simulator.electLeader(f.nodes[2]), false);
    assert.equal(f.simulator.electionTimeoutMs, 600);
    await elect(f, f.nodes[1]);
    assert.equal(f.simulator.leader().id, "B");
});

test("a higher-term follower forces the obsolete leader to step down", async t => {
    const f = setup(t);
    await elect(f);
    f.nodes[1].currentTerm = 10;
    assert.equal(await f.simulator.heartbeat(), false);
    assert.equal(f.nodes[0].currentTerm, 10);
    assert.equal(f.simulator.leader(), undefined);
});

test("conflicting committed history is never overwritten", async t => {
    const f = setup(t);
    await elect(f);
    f.nodes[1].log = [{ index: 1, term: 1, command: "committed=1" }];
    f.nodes[1].commitIndex = 1;
    assert.equal(await f.simulator.heartbeat(), false);
    assert.equal(f.simulator.reason, "COMMITTED_LOG_CONFLICT");
    assert.equal(f.nodes[1].log[0].command, "committed=1");
});

test("restart restores logs, votes, terms and timeout, but never leadership", async t => {
    const f = setup(t);
    await elect(f);
    await f.simulator.replicate("durable=1");
    await f.simulator.heartbeat();
    f.simulator.electionTimeoutMs = 1200;
    f.simulator.persist();
    const nodes = [new Node("A"), new Node("B"), new Node("C")];
    const restored = new HardenedSimulator(new Cluster(nodes), new Network(), f.options);
    assert.deepEqual(restored.snapshot(), f.simulator.snapshot());
    assert.equal(restored.suspended, true);
    assert.equal(restored.leader(), undefined);
    assert.equal(await restored.replicate("blocked=1"), false);
    await restored.resume();
    f.advance(1200);
    assert.equal(await restored.tick(), true);
    assert.equal(await restored.replicate("durable=2"), true);
});

test("corrupt persistent state is rejected without overwriting evidence", t => {
    const f = setup(t);
    const file = path.join(f.directory, "state.json");
    fs.writeFileSync(file, '{"checksum":"bad","payload":"{}"}');
    assert.throws(() => new HardenedSimulator(new Cluster(f.nodes), f.network, f.options), /checksum/);
    assert.equal(fs.readFileSync(file, "utf8"), '{"checksum":"bad","payload":"{}"}');
});

test("a valid checksum does not bypass log structure validation", t => {
    const f = setup(t);
    const state = f.simulator.snapshot();
    state.nodes[0].commitIndex = 10;
    new StateStore(f.directory).save(state);
    assert.throws(() => new HardenedSimulator(new Cluster(f.nodes), f.network, f.options), /node state/);
});

test("disk failure stops the protocol before sending replication messages", async t => {
    const f = setup(t);
    await elect(f);
    const sends = f.messages.length;
    f.simulator.store.save = () => { throw new Error("disk full"); };
    await assert.rejects(f.simulator.replicate("unpersisted=1"), /disk full/);
    assert.equal(f.simulator.reason, "STORAGE_ERROR");
    assert.equal(f.simulator.leader(), undefined);
    assert.equal(f.messages.length, sends);
    assert.equal(await f.simulator.replicate("blocked=1"), false);
});

test("concurrent client calls are serialized into consecutive log entries", async t => {
    const f = setup(t);
    await elect(f);
    const results = await Promise.all([f.simulator.replicate("x=1"), f.simulator.replicate("x=2")]);
    assert.deepEqual(results, [true, true]);
    assert.deepEqual(f.nodes[0].log.map(entry => entry.index), [1, 2]);
    assert.equal(f.nodes[0].commitIndex, 2);
});

test("the running monitor detects a disconnection without an explicit tick", async t => {
    const f = setup(t);
    t.after(() => f.simulator.stop());
    await elect(f);
    f.simulator.start(5);
    f.network.partitioned = true;
    // Yield to the monitor, with a bounded wait for slower CI hosts.
    for (let i = 0; i < 50 && !f.simulator.suspended; i++) await delay(10);
    await f.simulator.stop();
    assert.equal(f.simulator.reason, "NETWORK_DISCONNECTED");
    assert.equal(f.simulator.leader(), undefined);
});
