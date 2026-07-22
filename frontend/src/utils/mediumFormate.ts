export const mediumFormate = (medium: string) =>{
    let value;
    if (medium.includes(',')){
        value = medium.split(',')[0];
    } else if (medium.includes('、')){
        value = medium.split('、')[0];
    } else{
        value = medium.replace('ALLGRIT', '公式LINE');
    }
    return value;
};