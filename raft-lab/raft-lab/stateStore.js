const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// One durable snapshot for this single-process teaching simulator.
class StateStore {
    constructor(directory) {
        this.directory = path.resolve(directory);
        fs.mkdirSync(this.directory, { recursive: true });
        this.filename = path.join(this.directory, "state.json");
        this.auditFilename = path.join(this.directory, "audit.jsonl");
    }

    save(state) {
        const payload = JSON.stringify(state);
        const checksum = crypto.createHash("sha256").update(payload).digest("hex");
        const temporary = `${this.filename}.tmp`;
        const fd = fs.openSync(temporary, "w");
        try {
            fs.writeFileSync(fd, JSON.stringify({ checksum, payload }, null, 2));
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(temporary, this.filename);
    }

    load() {
        if (!fs.existsSync(this.filename)) return null;
        const { checksum, payload } = JSON.parse(fs.readFileSync(this.filename, "utf8"));
        if (typeof payload !== "string" ||
            crypto.createHash("sha256").update(payload).digest("hex") !== checksum) {
            throw new Error("Persistent state checksum mismatch; recovery refused");
        }
        return JSON.parse(payload);
    }

    audit(event) {
        fs.appendFileSync(this.auditFilename, `${JSON.stringify(event)}\n`);
    }
}

module.exports = StateStore;
