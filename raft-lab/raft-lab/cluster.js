class Cluster {

    constructor(nodes) {
        this.nodes = nodes;
    }

    majority() {
        return Math.floor(this.nodes.length / 2) + 1;
    }

    onlineNodes() {
        return this.nodes.filter(node => node.online);
    }

    hasMajority() {
        return (this.onlineNodes().length >=this.majority()
        );
    }

    leader() {
        return this.nodes.find(node =>node.role === "LEADER");
    }
}

module.exports = Cluster;