
const Quorum = require("./quorum");

class Simulator {

    constructor(proposer, acceptors, learners) {

        this.proposer = proposer;
        this.acceptors = acceptors;
        this.learners = learners;

        this.quorum = new Quorum(acceptors.length);
    }

    run(value) {

        console.log("\n====================");
        console.log(`Proposal Value = ${value}`);
        console.log("====================");

        console.log(`Acceptors: ${this.acceptors.length}`);
        console.log(`Required Quorum: ${this.quorum.majority()}`);
        console.log("");

        const proposal = this.proposer.nextProposal(value);

        /*
         * PREPARE
         */

        const promises = [];

        for (const acceptor of this.acceptors) {

            const response = acceptor.prepare(proposal.number);
            if (response) {
                promises.push(response);
                console.log(`${acceptor.id} PROMISE`);
            }
        }

        console.log(`Promises Received: ${promises.length}/${this.acceptors.length}`);

        if (!this.quorum.reached(promises.length)) {
            console.log("FAILED: no quorum of promises");
            return;
        }

        /*
         * PAXOS SAFETY RULE
         *
         * If any acceptor reports a previously
         * accepted value, continue proposing
         * the highest-numbered accepted value.
         */

        let highestAccepted = null;

        for (const promise of promises) {

            if (promise.accepted) {
                if (highestAccepted === null) {
                    highestAccepted = promise.accepted;

                } else if (promise.accepted.number > highestAccepted.number) {
                    highestAccepted = promise.accepted;
                }
            }
        }

        if (highestAccepted) {

            console.log("\nPREVIOUSLY ACCEPTED VALUE FOUND");
            console.log(`Proposal ${highestAccepted.number}`);

            console.log(`Value = ${highestAccepted.value}`);

            console.log("Overriding proposer value to preserve safety");

            proposal.value = highestAccepted.value;
        }

        /*
         * ACCEPT
         */

        const accepted = [];

        for (const acceptor of this.acceptors) {

            const response = acceptor.accept(proposal);

            if (response) {
                accepted.push(response);
                console.log(`${acceptor.id} ACCEPTED`);
            }
        }

        console.log(`Acceptances Received: ${accepted.length}/${this.acceptors.length}`);

        if (!this.quorum.reached(accepted.length)) {
            console.log("FAILED: no quorum of accepts");
            return;
        }

        /*
         * LEARN
         */

        console.log(`VALUE CHOSEN: ${proposal.value}`);

        for (const learner of this.learners) {
            learner.learn(proposal.value);
        }
    }
}

module.exports = Simulator;