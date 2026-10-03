/* Synthetic secure-message and bulk-transfer failures. SPDX-License-Identifier: LGPL-2.1-or-later */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "secure.h"
#include "utils.h"
#include "const.h"
#include "log.h"

extern netmd_error netmd_recv_secure_msg(netmd_dev_handle *,unsigned char,netmd_response *,unsigned char);
extern netmd_error netmd_transfer_song_packets(netmd_dev_handle *,netmd_track_packets *,size_t);
static int sent,received,send_result,receive_result,bulk_calls,bulk_result,bulk_short;
int netmd_send_message(netmd_dev_handle *dev,unsigned char *cmd,const size_t length) {
    (void)dev;assert(length==12 && cmd[10]==0x80);sent++;return send_result;
}
int netmd_recv_message(netmd_dev_handle *dev,unsigned char *out) {
    (void)dev;received++;
    unsigned char reply[]={0x09,0x18,0,8,0,0x46,0xf0,3,1,3,0x80,0};
    if(receive_result>0)memcpy(out,reply,(size_t)receive_result);
    return receive_result;
}
int netmd_recv_message_timeout(netmd_dev_handle *dev,unsigned char *out,unsigned int timeout) {
    assert(timeout==20000);return netmd_recv_message(dev,out);
}
int LIBUSB_CALL libusb_bulk_transfer(libusb_device_handle *dev,unsigned char endpoint,
        unsigned char *data,int length,int *transferred,unsigned int timeout) {
    (void)dev;(void)data;(void)timeout;assert(endpoint==2);bulk_calls++;
    *transferred=bulk_short?length-1:length;return bulk_result;
}
const char * LIBUSB_CALL libusb_strerror(enum libusb_error code) {(void)code;return "stub USB result";}
static void reset(void) {sent=received=bulk_calls=0;send_result=0;receive_result=12;bulk_result=0;bulk_short=0;}
int main(void) {
    netmd_set_log_level(NETMD_LOG_NONE);
    reset();send_result=NETMDERR_USB;assert(netmd_secure_enter_session(NULL)==NETMD_USB_ERROR);assert(sent==1 && received==0);
    reset();receive_result=NETMDERR_TIMEOUT;assert(netmd_secure_enter_session(NULL)==NETMD_USB_ERROR);assert(received==1);
    reset();receive_result=0;assert(netmd_secure_enter_session(NULL)==NETMD_COMMAND_FAILED_NO_RESPONSE);
    reset();receive_result=4;assert(netmd_secure_enter_session(NULL)==NETMD_RESPONSE_TO_SHORT);
    reset();assert(netmd_secure_enter_session(NULL)==NETMD_NO_ERROR);
    reset();receive_result=NETMDERR_USB;netmd_response reply;memset(&reply,0xa5,sizeof(reply));
    assert(netmd_recv_secure_msg(NULL,0x80,&reply,NETMD_STATUS_ACCEPTED)==NETMD_USB_ERROR);
    assert(reply.length==0 && reply.position==0 && reply.content[0]==0);
    unsigned char key[8]={0},iv[8]={0},data[8]={0};
    netmd_track_packets second={key,iv,data,8,NULL},first={key,iv,data,8,&second};
    reset();bulk_result=LIBUSB_ERROR_TIMEOUT;assert(netmd_transfer_song_packets(NULL,&first,16)==NETMD_USB_ERROR);assert(bulk_calls==1);
    reset();bulk_short=1;assert(netmd_transfer_song_packets(NULL,&first,16)==NETMD_USB_ERROR);assert(bulk_calls==1);
    reset();assert(netmd_transfer_song_packets(NULL,&first,16)==NETMD_NO_ERROR);assert(bulk_calls==2);
    netmd_track_packets *allocated=calloc(1,sizeof(*allocated));assert(allocated);
    allocated->key=calloc(1,8);allocated->iv=calloc(1,8);allocated->data=calloc(1,8);
    netmd_cleanup_packets(&allocated);assert(allocated==NULL);
    netmd_cleanup_packets(&allocated);assert(allocated==NULL);
    puts("Native secure layer: 10 cases passed (signed errors, short replies, partial bulk writes and repeated cleanup).");
}
