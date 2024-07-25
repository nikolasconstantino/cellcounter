let totalCount = 0;
let contagemEritroblasto = 0;
const cellMapping = {
    'q': 'count-q',
    'w': 'count-w',
    'e': 'count-e',
    'r': 'count-r',
    't': 'count-t',
    'y': 'count-y',
    'u': 'count-u',
    'i': 'count-i',
    'o': 'count-o',
    'p': 'count-p',
    'd': 'count-d',
    'f': 'count-f',
    'g': 'count-g',
    'h': 'count-h',
    's': 'count-s',
    'j': 'count-j',
    'l': 'count-l',
    'k': 'count-k',
    'a': 'count-a'
};

// som de finalização
var finishSound = new Audio('sounds/finish.mp3');



document.addEventListener('keydown', function (event) {
    const key = event.key.toLowerCase();
    //se a tecla for "p", conta apenas eritroblasto
    if (key === 'p') {
        contagemEritroblasto++;
        document.getElementById('specific-count').textContent = contagemEritroblasto;
        document.getElementById('eritro-count').textContent = contagemEritroblasto;
    }

    const countId = cellMapping[key];
    const countElement = document.getElementById(countId);
    if (countElement) {
        const currentCount = parseInt(countElement.textContent, 10) + 1;
        countElement.textContent = currentCount;
        totalCount++;


        document.getElementById('total').textContent = totalCount;
        if (totalCount === 100) {
            document.getElementById('total-counter').style.color = 'red';
            finishSound.play(); // toca o som de finalização
            alert('Você já contou 100 células!');
        }
    }
});
function resetCount() {
    totalCount = 0;
    contagemEritroblasto = 0;
    document.getElementById('total').textContent = totalCount;
    for (const key in cellMapping) {
        const countId = cellMapping[key];
        document.getElementById(countId).textContent = '0';
    }
    document.getElementById('total-counter').style.color = 'black';
    document.getElementById('specific-count').textContent = '0';
}

//Detecta quando a janela não está em foco e exibe a mensagem
window.addEventListener('blur', function () {
    document.getElementById('focus-message').style.display = 'flex';
    document.querySelector('.container').classList.add('container-blurred')
}
);

//Detecta quando a janela está em foco e esconde a mensagem
window.addEventListener('focus', function () {
    document.getElementById('focus-message').style.display = 'none';
    document.querySelector('.container').classList.remove('container-blurred')
}
);

//exibe alerta ao tentar recarregar a página
window.addEventListener('beforeunload',
    function (event) {
        const confirmationMessage = 'A contagem de células será perdida. Deseja continuar?';
        event.returnValue = confirmationMessage;

    }
)

function incrementCount(key) {
    const countElement = document.getElementById(cellMapping[key]);
    if (countElement) {
        const currentCount = parseInt(countElement.textContent, 10) + 1;
        countElement.textContent = currentCount;
        if (key !== 'p') {
            updateTotalCount(1); // Adiciona ao total apenas se não for 's'
        }
    }
}

function decrementCount(key) {
    const countElement = document.getElementById(cellMapping[key]);
    if (countElement) {
        const currentCount = parseInt(countElement.textContent, 10);
        if (currentCount > 0) {
            countElement.textContent = currentCount - 1;
            if (key !== 'p') {
                updateTotalCount(-1); // Subtrai do total apenas se não for 's'
            }
        }
    }
}

function updateTotalCount(value) {
    totalCount += value;
    document.getElementById('total').textContent = totalCount;

}
