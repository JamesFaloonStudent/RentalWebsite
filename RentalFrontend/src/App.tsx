import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ListingDetails from './pages/ListingDetails'
import Booking from './pages/Booking'
import AddListing from './pages/AddListing'
import EditListing from './pages/EditListing'
import Login from './pages/Login'
import MyRentals from './pages/MyRentals'
import Contact from './pages/Contact'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/listings/new" element={<AddListing />} />
        <Route path="/listings/:id" element={<ListingDetails />} />
        <Route path="/listings/:id/book" element={<Booking />} />
        <Route path="/listings/:id/edit" element={<EditListing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/my-rentals" element={<MyRentals />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
