const Proposal =
    require("./proposal");

class Proposer {

    constructor(id) {

        this.id = id;

        this.proposalNumber = 100;
    }

    nextProposal(value) {

        this.proposalNumber++;

        return new Proposal(
            this.proposalNumber,
            value
        );
    }
}

module.exports = Proposer;