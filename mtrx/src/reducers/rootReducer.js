import { combineReducers }  from 'redux'
import mtrxControlRdcr      from './mtrxControlRdcr'
import authControlRdcr      from './authControlRdcr'

export default combineReducers({
  mtrxControlRdcr,
  authControlRdcr,
})