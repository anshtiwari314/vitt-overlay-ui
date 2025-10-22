import { configureStore } from "@reduxjs/toolkit";
import transcriptionReducer from '../reducers/TranscriptionReducer'

let store = configureStore({
    reducer:{
        transcriptionReducer
    }
    
})


export default store;

