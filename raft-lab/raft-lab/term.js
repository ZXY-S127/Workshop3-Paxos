class Term {

    constructor(number = 0) {
        this.number = number;
    }

    next() {
        this.number++;
        return this.number;
    }
}

module.exports = Term;
``