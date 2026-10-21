
class Node {

    constructor(id) {
        this.id = id;
        this.role = "FOLLOWER";
        this.currentTerm = 0;
        this.votedFor = null;
        this.log = [];
        this.online = true;
    }

    becomeFollower(term) {
        this.role = "FOLLOWER";
        this.currentTerm = term;

        console.log(`${this.id} -> FOLLOWER`);
    }

    becomeCandidate() {
        this.role = "CANDIDATE";
        this.currentTerm++;
        this.votedFor = this.id;

        console.log(`${this.id} -> CANDIDATE (TERM ${this.currentTerm})`);
    }

    becomeLeader() {
        this.role = "LEADER";
        console.log(`${this.id} -> LEADER`);
    }

    fail() {
        this.online = false;
        console.log(`${this.id} OFFLINE`);
    }

    recover() {
        this.online = true;
        console.log(`${this.id} ONLINE`);
    }
}

module.exports = Node;