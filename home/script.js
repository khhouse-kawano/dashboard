fetch('./informaiton.php')
.then(response =>{
    if (response.ok){
        return response.json()
    } else {
        throw new Error('Network response was not ok')
    }
})
.then(data => {
    console.log(data)
})
.catch(error => {
    console.error('There has been a problem with your fetch operation:', error)
});