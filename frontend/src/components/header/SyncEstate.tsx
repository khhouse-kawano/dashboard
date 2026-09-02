import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { baseURL } from '../../utils/baseURL';
import { headers } from '../../utils/headers';

type Props = {
    setModal: React.Dispatch<React.SetStateAction<boolean>>
}

const SyncEstate = ({ setModal }: Props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadMessage, setLoadMessage] = useState('土地情報の同期開始');
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.post(`https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/estate_info`, {}, { headers });
                // const response = await axios.post(`${baseURL}/api/estate_info`, {}, { headers });
                console.log(response.data);
                if (response.data.status === "processing") {
                    setIsLoading(true);
                }
            } catch (error) {
                console.error('リクエストエラー:', error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            setLoadMessage('同期に失敗');
            setTimeout(() => {
                setModal(false);
            }, 1000);
        } else {
            setLoadMessage('土地情報の同期中');
            setTimeout(() => {
                setModal(false);
            }, 1000);
        }
    }, [isLoading]);

    return (
        <div>{loadMessage}</div>
    )
}

export default SyncEstate