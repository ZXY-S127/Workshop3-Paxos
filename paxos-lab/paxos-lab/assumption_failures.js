function loseState(acceptor) {
    acceptor.highestPromised = 0;
    acceptor.acceptedProposal = null;
}

function loseState(acceptor) {
    console.log(`${acceptor.id} LOST STATE`);
    acceptor.highestPromised = 0;
    acceptor.acceptedProposal = null;
}

function networkPartition(acceptors) {

    const split = Math.ceil(acceptors.length / 2);

    return {
        majority: acceptors.slice(0,split),
        minority: acceptors.slice(split)
    };
}


function misconfigureQuorum(quorum) {
    quorum.majority = () => 2;
}

module.exports = {
    loseState,
    networkPartition,
    misconfigureQuorum
};