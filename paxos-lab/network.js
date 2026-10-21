class Network {

    constructor() {
        this.partitioned = false;
    }

    send(message) {

        if (this.partitioned) {

            console.log(`NETWORK DROPPED: ${message}`);
            return false;
        }

        console.log(`NETWORK DELIVERED: ${message}`);
        return true;
    }

    partition() {
        this.partitioned = true;
        console.log("NETWORK PARTITION ACTIVE");
    }

    repair() {
        this.partitioned = false;
        console.log("NETWORK PARTITION REPAIRED");
    }
}

module.exports = Network;