const { performance } = require("node:perf_hooks");
const path = require("node:path");
const Simulator = require("./simulator");
const LogEntry = require("./logEntry");
const StateStore = require("./stateStore");

const copy = value => JSON.parse(JSON.stringify(value));
const copyLog = log => log.map(entry => new LogEntry(entry.index, entry.term, entry.command));
const sameEntry = (a, b) => Boolean(a && b && a.index === b.index &&
    a.term === b.term && a.command === b.command);

class HardenedSimulator extends Simulator {
    constructor(cluster, network, options = {}) {
        super(cluster, network);
        this.now = options.now ?? (() => performance.now());
        this.random = options.random ?? Math.random;
        this.output = options.output ?? console.log;
        this.processMessage = options.processMessage ?? (async () => {});
        this.electionTimeoutMs = options.electionTimeoutMs ?? 300;
        this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 50;
        this.rpcTimeoutMs = options.rpcTimeoutMs ?? 150;
        this.slowMessageMs = options.slowMessageMs ?? 50;
        this.churnWindowMs = options.churnWindowMs ?? 5000;
        this.churnThreshold = options.churnThreshold ?? 3;
        for (const name of ["electionTimeoutMs", "heartbeatIntervalMs", "rpcTimeoutMs",
            "slowMessageMs", "churnWindowMs"]) {
            if (!Number.isFinite(this[name]) || this[name] <= 0) {
                throw new Error(`Invalid ${name}`);
            }
        }
        if (this.electionTimeoutMs < 100 || this.heartbeatIntervalMs >= this.electionTimeoutMs ||
            !Number.isInteger(this.churnThreshold) || this.churnThreshold < 2) {
            throw new Error("Unsafe election timeout or churn threshold");
        }
        const ids = cluster.nodes.map(node => node.id);
        if (!ids.length || new Set(ids).size !== ids.length ||
            ids.some(id => typeof id !== "string" || !id)) {
            throw new Error("Cluster needs unique non-empty node IDs");
        }
        this.store = options.store ?? new StateStore(options.stateDirectory ??
            path.join(__dirname, "runtime", "hardened"));
        this.suspended = false;
        this.reason = null;
        this.cooldownUntil = 0;
        this.elections = [];
        this.deadlines = new Map();
        this.lastHeartbeat = -Infinity;
        this.metrics = { elections: 0, churnIncidents: 0, messages: 0,
            slowMessages: 0, timedOutMessages: 0, maxProcessingMs: 0 };
        this.queue = Promise.resolve();
        for (const node of cluster.nodes) node.commitIndex ??= 0;

        const state = this.store.load();
        if (state) {
            this.validateState(state);
            this.electionTimeoutMs = state.electionTimeoutMs;
            for (const saved of state.nodes) {
                Object.assign(cluster.nodes.find(node => node.id === saved.id), copy(saved),
                    { log: copyLog(saved.log) });
            }
            this.suspended = true;
            this.reason = "RESTART_REQUIRES_RESUME";
        }
        // Leadership is never restored from disk or inherited from the basic simulator.
        this.demoteAll();
        this.resetDeadlines();
        this.persist();
        this.record(state ? "STATE_RESTORED" : "STARTED");
    }

    snapshot() {
        return { version: 1, electionTimeoutMs: this.electionTimeoutMs,
            nodes: this.cluster.nodes.map(({ id, currentTerm, votedFor, log, commitIndex }) =>
                ({ id, currentTerm, votedFor, log: copy(log), commitIndex })) };
    }

    validateState(state) {
        const integer = value => Number.isSafeInteger(value) && value >= 0;
        const ids = new Set(this.cluster.nodes.map(node => node.id));
        if (state.version !== 1 || !Number.isFinite(state.electionTimeoutMs) ||
            state.electionTimeoutMs < 100 || state.electionTimeoutMs <= this.heartbeatIntervalMs ||
            !Array.isArray(state.nodes) || state.nodes.length !== ids.size) {
            throw new Error("Invalid persistent state configuration");
        }
        const seen = new Set();
        for (const node of state.nodes) {
            if (!node || !ids.has(node.id) || seen.has(node.id) ||
                !integer(node.currentTerm) || !integer(node.commitIndex) ||
                (node.votedFor !== null && !ids.has(node.votedFor)) ||
                !Array.isArray(node.log) || node.commitIndex > node.log.length) {
                throw new Error("Invalid persistent node state");
            }
            seen.add(node.id);
            let previousTerm = 0;
            node.log.forEach((entry, i) => {
                if (!entry || entry.index !== i + 1 || !integer(entry.term) ||
                    entry.term < previousTerm || entry.term > node.currentTerm ||
                    typeof entry.command !== "string") {
                    throw new Error("Invalid persistent log entry");
                }
                previousTerm = entry.term;
            });
        }
        for (const a of state.nodes) {
            for (const b of state.nodes) {
                for (let i = 0; i < Math.min(a.commitIndex, b.commitIndex); i++) {
                    if (!sameEntry(a.log[i], b.log[i])) {
                        throw new Error("Conflicting committed histories; recovery refused");
                    }
                }
            }
        }
    }

    storageFailure(error) {
        this.suspended = true;
        this.reason = "STORAGE_ERROR";
        this.demoteAll();
        this.output(`STORAGE_ERROR: ${error.message}; protocol stopped`);
        throw error;
    }

    persist() {
        try {
            const state = this.snapshot();
            this.validateState(state);
            this.store.save(state);
        } catch (error) {
            this.storageFailure(error);
        }
    }

    record(event, details = {}) {
        const entry = { timeMs: this.now(), event, ...details };
        try { this.store.audit(entry); } catch (error) { this.storageFailure(error); }
        this.output(`${event} ${JSON.stringify(details)}`);
    }

    demoteAll() {
        for (const node of this.cluster.nodes) node.role = "FOLLOWER";
    }

    leader() {
        return this.cluster.nodes.find(node => node.online && node.role === "LEADER");
    }

    resetDeadline(node) {
        const jitter = this.random();
        if (!Number.isFinite(jitter) || jitter < 0 || jitter >= 1) {
            throw new Error("random() must return a number in [0, 1)");
        }
        this.deadlines.set(node.id, this.now() + this.electionTimeoutMs * (1 + jitter));
    }

    resetDeadlines() {
        for (const node of this.cluster.nodes) this.resetDeadline(node);
    }

    suspend(reason) {
        if (this.suspended) return false;
        this.suspended = true;
        this.reason = reason;
        this.demoteAll();
        this.persist();
        this.record("SUSPENDED", { reason, logsSaved: true });
        return false;
    }

    checkHealth() {
        if (this.suspended) return false;
        // Observing a crash revokes the old role, so recover() cannot revive a leader.
        for (const node of this.cluster.nodes) {
            if (!node.online) node.role = "FOLLOWER";
        }
        if (this.network.partitioned) return this.suspend("NETWORK_DISCONNECTED");
        if (!this.cluster.hasMajority()) return this.suspend("NO_MAJORITY");
        return true;
    }

    // Public operations are serialized so asynchronous handlers cannot race elections.
    run(operation) {
        const result = this.queue.then(operation);
        this.queue = result.catch(() => {});
        return result;
    }

    resume() {
        return this.run(() => {
            if (!this.suspended) return true;
            if (this.network.partitioned || !this.cluster.hasMajority()) return false;
            this.persist();
            this.demoteAll();
            this.elections = [];
            this.resetDeadlines();
            // Retain the doubled timeout, including across a process restart.
            this.cooldownUntil = this.now() + this.electionTimeoutMs;
            this.suspended = false;
            this.reason = null;
            this.record("RESUMED", { electionTimeoutMs: this.electionTimeoutMs });
            return true;
        });
    }

    async rpc(from, to, type, handle) {
        if (!this.checkHealth() || !from.online || !to.online) return false;
        const term = from.currentTerm;
        const message = `${from.id} -> ${to.id} ${type} term=${term}`;
        let timer;
        let processingMs = 0;
        const controller = new AbortController();
        const started = performance.now();
        try {
            this.metrics.messages++;
            if (!this.network.send(message)) return this.suspend("MESSAGE_DELIVERY_FAILED");
            await Promise.race([
                Promise.resolve().then(() => this.processMessage({
                    from: from.id, to: to.id, type, signal: controller.signal
                })),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error("RPC_TIMEOUT")), this.rpcTimeoutMs);
                })
            ]);
            processingMs = performance.now() - started;
            // Also catches a synchronous handler that blocked the event loop past its deadline.
            if (processingMs >= this.rpcTimeoutMs) throw new Error("RPC_TIMEOUT");
            if (!this.checkHealth() || !from.online || !to.online || from.currentTerm !== term) {
                return false;
            }
            const accepted = handle();
            this.persist(); // Persist the vote/log before acknowledging it.
            processingMs = performance.now() - started;
            if (processingMs >= this.rpcTimeoutMs) throw new Error("RPC_TIMEOUT");
            if (!this.checkHealth()) return false;
            this.metrics.messages++;
            if (!this.network.send(`${to.id} -> ${from.id} ${accepted ? "ACK" : "REJECT"} ${type}`)) {
                return this.suspend("ACK_DELIVERY_FAILED");
            }
            return accepted;
        } catch (error) {
            if (this.reason === "STORAGE_ERROR") throw error;
            if (error.message === "RPC_TIMEOUT") this.metrics.timedOutMessages++;
            return this.suspend(error.message === "RPC_TIMEOUT" ? "MESSAGE_TIMEOUT" : "MESSAGE_ERROR");
        } finally {
            clearTimeout(timer);
            controller.abort();
            processingMs = Math.max(processingMs, performance.now() - started);
            this.metrics.maxProcessingMs = Math.max(this.metrics.maxProcessingMs, processingMs);
            if (processingMs >= this.slowMessageMs) this.metrics.slowMessages++;
            this.record(processingMs >= this.slowMessageMs ? "SLOW_MESSAGE" : "MESSAGE_PROCESSED",
                { from: from.id, to: to.id, type, processingMs: Number(processingMs.toFixed(2)) });
        }
    }

    adoptTerm(node, term) {
        if (term > node.currentTerm) {
            node.currentTerm = term;
            node.votedFor = null;
            node.role = "FOLLOWER";
        }
    }

    isUpToDate(candidate, voter) {
        const a = candidate.log.at(-1);
        const b = voter.log.at(-1);
        return (a?.term ?? 0) > (b?.term ?? 0) ||
            ((a?.term ?? 0) === (b?.term ?? 0) && candidate.log.length >= voter.log.length);
    }

    electLeader(node) { return this.run(() => this.elect(node)); }

    async elect(node) {
        if (!this.cluster.nodes.includes(node)) throw new Error("Candidate is not a cluster member");
        if (!this.checkHealth() || !node.online || this.leader()) return false;
        const now = this.now();
        if (now < this.cooldownUntil || now < this.deadlines.get(node.id)) {
            this.record("ELECTION_DELAYED", { node: node.id, timeoutMs: this.electionTimeoutMs });
            return false;
        }
        this.elections = this.elections.filter(time => now - time <= this.churnWindowMs);
        this.elections.push(now);
        if (this.elections.length >= this.churnThreshold) {
            const nextTimeout = this.electionTimeoutMs * 2;
            if (!Number.isSafeInteger(Math.ceil(nextTimeout))) return this.suspend("TIMEOUT_OVERFLOW");
            this.electionTimeoutMs = nextTimeout;
            this.metrics.churnIncidents++;
            this.cooldownUntil = now + nextTimeout;
            this.elections = [];
            this.resetDeadlines();
            this.persist();
            this.record("LEADERSHIP_CHURN", { timeoutMs: nextTimeout, cooldownUntil: this.cooldownUntil });
            return false;
        }
        // Clear obsolete roles, including a failed leader's role.
        this.demoteAll();
        node.currentTerm++;
        node.role = "CANDIDATE";
        node.votedFor = node.id;
        this.metrics.elections++;
        this.resetDeadline(node);
        this.persist();
        let votes = 1;
        for (const peer of this.cluster.nodes) {
            if (peer === node || !peer.online) continue;
            const granted = await this.rpc(node, peer, "REQUESTVOTE", () => {
                if (peer.currentTerm > node.currentTerm) {
                    this.adoptTerm(node, peer.currentTerm);
                    return false;
                }
                this.adoptTerm(peer, node.currentTerm);
                if ((peer.votedFor === null || peer.votedFor === node.id) && this.isUpToDate(node, peer)) {
                    peer.votedFor = node.id;
                    this.resetDeadline(peer);
                    return true;
                }
                return false;
            });
            if (this.suspended || node.role !== "CANDIDATE") return false;
            if (granted) votes++;
        }
        if (!node.online || !this.checkHealth() || votes < this.cluster.majority()) {
            node.role = "FOLLOWER";
            this.record("ELECTION_FAILED", { node: node.id, votes });
            return false;
        }
        node.role = "LEADER";
        this.lastHeartbeat = -Infinity;
        this.persist();
        this.record("LEADER_ELECTED", { node: node.id, term: node.currentTerm, votes });
        return true;
    }

    append(leader, peer) {
        if (peer.currentTerm > leader.currentTerm) {
            this.adoptTerm(leader, peer.currentTerm);
            return false;
        }
        this.adoptTerm(peer, leader.currentTerm);
        // Full-log replay keeps catch-up visible in this small simulator.
        // A committed prefix can never be truncated or overwritten.
        for (let i = 0; i < peer.commitIndex; i++) {
            if (!sameEntry(peer.log[i], leader.log[i])) {
                this.suspend("COMMITTED_LOG_CONFLICT");
                return false;
            }
        }
        peer.role = "FOLLOWER";
        peer.log = copyLog(leader.log);
        peer.commitIndex = Math.max(peer.commitIndex, leader.commitIndex);
        this.resetDeadline(peer);
        return true;
    }

    heartbeat() { return this.run(() => this.sendHeartbeat()); }

    async sendHeartbeat() {
        if (!this.checkHealth()) return false;
        const leader = this.leader();
        if (!leader) return false;
        let acknowledgements = 1;
        for (const peer of this.cluster.nodes) {
            if (peer === leader || !peer.online) continue;
            if (await this.rpc(leader, peer, "APPENDENTRIES/HEARTBEAT", () => this.append(leader, peer))) {
                acknowledgements++;
            }
            if (this.suspended || this.leader() !== leader) return false;
        }
        if (acknowledgements < this.cluster.majority()) return this.suspend("NO_HEARTBEAT_QUORUM");
        this.lastHeartbeat = this.now();
        this.record("HEARTBEAT_OK", { acknowledgements });
        return true;
    }

    replicate(command) {
        return this.run(async () => {
            if (typeof command !== "string" || !command) throw new Error("Command must be a non-empty string");
            if (!this.checkHealth()) return false;
            const leader = this.leader();
            if (!leader || this.now() < this.cooldownUntil) return false;
            const entry = new LogEntry(leader.log.length + 1, leader.currentTerm, command);
            leader.log.push(entry);
            this.persist();
            let acknowledgements = 1;
            for (const peer of this.cluster.nodes) {
                if (peer === leader || !peer.online) continue;
                if (await this.rpc(leader, peer, "APPENDENTRIES/REPLICATE", () => this.append(leader, peer))) {
                    acknowledgements++;
                }
                if (this.suspended || this.leader() !== leader) return false;
            }
            if (!leader.online || !this.checkHealth() || acknowledgements < this.cluster.majority()) {
                return this.suspend("NO_REPLICATION_QUORUM");
            }
            leader.commitIndex = entry.index;
            this.persist();
            this.record("ENTRY_COMMITTED", { index: entry.index, command, acknowledgements });
            return true;
        });
    }

    tick() {
        return this.run(async () => {
            if (!this.checkHealth()) return false;
            const leader = this.leader();
            if (leader) {
                return this.now() - this.lastHeartbeat >= this.heartbeatIntervalMs
                    ? this.sendHeartbeat() : true;
            }
            if (this.now() < this.cooldownUntil) return false;
            const candidates = this.cluster.onlineNodes().filter(node =>
                this.now() >= this.deadlines.get(node.id));
            candidates.sort((a, b) => this.deadlines.get(a.id) - this.deadlines.get(b.id));
            return candidates.length ? this.elect(candidates[0]) : false;
        });
    }

    start(intervalMs = 25) {
        if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error("Invalid polling interval");
        if (this.running) return;
        this.running = true;
        const generation = (this.monitorGeneration ?? 0) + 1;
        this.monitorGeneration = generation;
        const poll = async () => {
            if (!this.running || this.monitorGeneration !== generation) return;
            try {
                await this.tick();
            } catch (error) {
                this.stop();
                this.output(`MONITOR_STOPPED: ${error.message}`);
                return;
            }
            if (this.running && this.monitorGeneration === generation) {
                this.monitorTimer = setTimeout(poll, intervalMs);
            }
        };
        this.monitorTimer = setTimeout(poll, 0);
    }

    stop() {
        this.running = false;
        this.monitorGeneration = (this.monitorGeneration ?? 0) + 1;
        clearTimeout(this.monitorTimer);
        return this.queue;
    }

    health() {
        const leader = this.leader();
        return { suspended: this.suspended, reason: this.reason, leader: leader?.id ?? null,
            online: this.cluster.onlineNodes().length, majority: this.cluster.majority(),
            electionTimeoutMs: this.electionTimeoutMs, cooldownUntil: this.cooldownUntil,
            metrics: { ...this.metrics }, nodes: this.cluster.nodes.map(node => ({
                id: node.id, online: node.online, role: node.role, term: node.currentTerm,
                logLength: node.log.length, commitIndex: node.commitIndex,
                lag: leader ? Math.max(0, leader.log.length - node.log.length) : null
            })) };
    }
}

module.exports = HardenedSimulator;
