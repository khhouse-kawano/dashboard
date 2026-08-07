import apiClient from "../../utils/apiClient";

export const monthFormate = (date: string) => {
    return date ? date.replace(/-/g, '/').slice(0, 7) : '';
};

export const dateFormate = (date: string) => {
    return date ? date.replace(/-/g, '/') : '';
};

export const handleBlack = async (brandValue: string, nameValue: string, mobileValue: string, mailValue: string, zipValue: string, addressValue: string, category: string) => {
    const fetchData = async () => {
        try {
            const response = await apiClient.post('',
                {
                    mobile: mobileValue,
                    mail: mailValue,
                    brand: brandValue,
                    name: nameValue,
                    zip: zipValue,
                    address: addressValue,
                    request: 'list',
                    category,
                    roll: 'black'
                });
            console.log(response.data.status);
        } catch (err) {
            console.error(err);
        }
    };
    fetchData();
};

/**
 * 全角数字・長音符・記号を変換し、数字とハイフンのみを抽出する（電話番号・郵便番号等に最適）
 */
export const toHalfWidth = (str: string): string =>
    str.normalize('NFKC').replace(/\D/g, '');
