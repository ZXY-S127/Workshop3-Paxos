class Acceptor {

    constructor(id) {

        this.id = id;
        this.highestPromised = 0;
        this.acceptedProposal = null;
        this.online = true;
    }

    fail() {
        this.online = false;
    }

    recover() {
        this.online = true;
    }

    prepare(number) {

        if (!this.online) {
            console.log(`${this.id} OFFLINE`);
            return null;
        }

        if (number > this.highestPromised) {
            this.highestPromised = number;

            if (this.acceptedProposal) {
                console.log(`${this.id} reports previously accepted:`);
                console.log(`(${this.acceptedProposal.number}, ${this.acceptedProposal.value})`);
            }

            return {
                type: "PROMISE",
                acceptor: this.id,
                proposalNumber: number,
                accepted: this.acceptedProposal
            };
        }

        return null;
    }

    accept(proposal) {

        if (!this.online) {
            console.log(`${this.id} OFFLINE`);
            return null;
        }

        if (proposal.number >=this.highestPromised) {
            this.highestPromised = proposal.number;
            this.acceptedProposal = proposal;

            return {
                type: "ACCEPTED",
                acceptor: this.id,
                proposal
            };
        }
        console.log(`${this.id} REJECTED proposal ${proposal.number}`);

        return null;
    }
}

module.exports = Acceptor;