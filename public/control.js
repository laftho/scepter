const Proxy = {
    start: () => {

    },
    stop: () => {

    },
    status: () => {
        $.ajax("/status")
        .done((data) => {

        });
    }
};
