
const LogEntry = require("./logEntry");

class Simulator {

    constructor(cluster,network) {
        this.cluster = cluster;
        this.network = network;
    }

    electLeader(node) {
        node.becomeCandidate();
        let votes = 1;

        for (const peer of this.cluster.nodes) {
            if (peer.id !== node.id && peer.online) {
                this.network.send(`${node.id} -> ${peer.id} REQUESTVOTE`);

                votes++;
            }
        }

        console.log(`Votes = ${votes}/${this.cluster.nodes.length}`);

        if (votes >= this.cluster.majority()) {
            node.becomeLeader();
        }
    }

    heartbeat() {
        const leader = this.cluster.leader();

        if (!leader) {
            console.log("NO LEADER");
            return;
        }

        for (const peer of this.cluster.nodes) {
            if (peer.id !== leader.id && peer.online) {
                this.network.send(`AppendEntries(term=${leader.currentTerm}, entries=[])`);
            }
        }
    }

    replicate(command) {

        const leader = this.cluster.leader();

        if (!leader) {
            console.log("NO LEADER");

            return;
        }

        const entry = new LogEntry(leader.log.length + 1, leader.currentTerm, command);

        leader.log.push(entry);

        console.log(`Leader created entry: ${command}`);

        let acknowledgements = 1;

        for (const peer of this.cluster.nodes) {
            if (peer.id !== leader.id && peer.online) {

                peer.log.push( entry);
                acknowledgements++;

                this.network.send(`AppendEntries(${command})`);
            }
        }

        if (acknowledgements >= this.cluster.majority()) {
            console.log("ENTRY COMMITTED");
        }
    }
}

module.exports = Simulator;