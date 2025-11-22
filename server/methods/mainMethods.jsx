const getDog = async (data) => {
    if(Array.isArray(data)){
        let array = []
        for(let item of data){
            const breed = item?.breed
            const response = await fetch('https://dog.ceo/api/breed/'+breed+'/images/random')
            const results = await response.json()
            array.push({src:results.message})
        }
        return array
    }
    else{
        const breed = data?.breed
        if(breed != undefined){
            const response = await fetch('https://dog.ceo/api/breed/'+breed+'/images/random')
            const results = await response.json()
            return {src:results.message, text:breed} 
        }
        else{
            const response = await fetch('https://dog.ceo/api/breeds/image/random')
            const results = await response.json()
            // console.log(results)
            return {src:results.message, text:'Random Dog'}
        }
    }
   
}


const wowzer = async () => {
   return  await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(['Wow', 'Zer', Math.random()])
        }, 100)
    })
}


const serverFunctions = {
    getDog,
    wowzer
}
export default serverFunctions
