class Learner {

    constructor(id) {
        this.id = id;
        this.value = null;
    }

    learn(value) {
        this.value = value;
        console.log(`${this.id} LEARNED CHOSEN VALUE: ${value}`);
    }
}

module.exports = Learner;