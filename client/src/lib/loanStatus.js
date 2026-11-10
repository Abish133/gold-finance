/** Status words of the desktop Pledge Book: Pending / In Bank / Released (also re-loaned) / Auctioned / Cancelled. */
export const bookStatus = (r) => (r.status === 'OPEN' ? (r.bank_pledge_id ? 'In Bank' : 'Pending')
  : r.status === 'CLOSED' || r.status === 'RENEWED' ? 'Released'
    : r.status === 'AUCTIONED' ? 'Auctioned' : r.status === 'CANCELLED' ? 'Cancelled' : r.status);
