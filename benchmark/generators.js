function *f() {
    yield 1;
    yield 2;
    yield 3;
}

function g() {
    const numbers = f();
    return numbers;
}

for (const c of f()) {
    console.log(c);
}

for (const c of g()) {
    console.log(c);
}