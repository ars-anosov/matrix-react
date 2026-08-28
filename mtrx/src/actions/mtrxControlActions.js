import {
  MTRXCTL_STORE_VALUE,
} from '../constants/redux'




const handleChangeStore = function(storeDataKey, storeDataValue) {
  return (dispatch) => {
    dispatch({
      type: MTRXCTL_STORE_VALUE,
      payload: {'storeDataKey': storeDataKey, 'storeDataValue': storeDataValue}
    })
  }
}



export {
  handleChangeStore,
}
