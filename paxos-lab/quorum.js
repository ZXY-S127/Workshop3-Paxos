class Quorum {

    constructor(size) {
        this.size = size;
    }

    majority() {
        return Math.floor(this.size / 2) + 1;
    }

    reached(count) {
        return count >=  this.majority();
    }
}

module.exports = Quorum;