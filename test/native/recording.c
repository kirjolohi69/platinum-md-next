/* Script the recording lifecycle without hardware. SPDX-License-Identifier: GPL-2.0-or-later */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "libnetmd.h"
#include "utils.h"

static const char *failure;
static int poisoned,opened,was_committed,prepared,sent,phase_calls;
static netmd_error phase(const char *name) {
    assert(!poisoned);phase_calls++;
    if(failure && strcmp(failure,name)==0){poisoned=1;return NETMD_USB_ERROR;}
    return NETMD_NO_ERROR;
}
int netmd_wait_for_sync(netmd_dev_handle *d){(void)d;assert(!poisoned);return 1;}
int netmd_acquire_dev(netmd_dev_handle *d){(void)d;return phase("acquire");}
int netmd_release_dev(netmd_dev_handle *d){(void)d;return phase("release");}
netmd_error netmd_secure_leave_session(netmd_dev_handle *d){(void)d;return phase(opened?"leave":"clear");}
netmd_error netmd_secure_set_track_protection(netmd_dev_handle *d,unsigned char mode){(void)d;assert(mode==1);return phase("protect");}
netmd_error netmd_secure_enter_session(netmd_dev_handle *d){(void)d;netmd_error e=phase("enter");if(!e)opened=1;return e;}
netmd_error netmd_secure_send_key_data(netmd_dev_handle *d,netmd_ekb *e){(void)d;assert(e->chain && e->chain->next);return phase("key");}
netmd_error netmd_secure_session_key_exchange(netmd_dev_handle *d,unsigned char *host,unsigned char *nonce){(void)d;(void)host;memset(nonce,0,8);return phase("nonce");}
netmd_error netmd_secure_setup_download(netmd_dev_handle *d,unsigned char *a,unsigned char *b,unsigned char *c){(void)d;(void)a;(void)b;(void)c;return phase("setup");}
netmd_error netmd_prepare_packets(unsigned char *data,size_t length,netmd_track_packets **p,size_t *count,unsigned int *frames,size_t channels,size_t *packet_length,unsigned char *key,netmd_wireformat format){
    (void)data;(void)key;assert(length==1764 && channels==NETMD_CHANNELS_STEREO && format==NETMD_WIREFORMAT_PCM);
    prepared++;netmd_error e=phase("packets");if(e)return e;
    *p=calloc(1,sizeof(**p));*count=1;*frames=1;*packet_length=length;return NETMD_NO_ERROR;
}
void netmd_cleanup_packets(netmd_track_packets **p){free(*p);*p=NULL;}
netmd_error netmd_secure_send_track(netmd_dev_handle *d,netmd_wireformat wire,unsigned char format,unsigned int frames,netmd_track_packets *p,size_t length,unsigned char *key,uint16_t *track,unsigned char *uuid,unsigned char *id){
    (void)d;(void)wire;(void)format;(void)frames;(void)p;(void)length;(void)key;(void)uuid;(void)id;sent++;*track=0;return phase("send");
}
int netmd_cache_toc(netmd_dev_handle *d){(void)d;return phase("cache")? -1:8;}
int netmd_set_title(netmd_dev_handle *d,const uint16_t track,const char *const title){(void)d;assert(track==0 && strcmp(title,"Test track")==0);return phase("title")?0:1;}
int netmd_sync_toc(netmd_dev_handle *d){(void)d;return phase("sync")?-1:8;}
netmd_error netmd_secure_commit_track(netmd_dev_handle *d,uint16_t track,unsigned char *key){(void)d;(void)track;(void)key;netmd_error e=phase("commit");if(!e)was_committed=1;return e;}
netmd_error netmd_secure_session_key_forget(netmd_dev_handle *d){(void)d;return phase("forget");}
static void fixture(const char *filename){
    unsigned char wav[44+1764]={0},*p=wav+4;
    memcpy(wav,"RIFF",4);netmd_copy_doubleword_to_buffer(&p,sizeof(wav)-8,1);
    memcpy(wav+8,"WAVEfmt ",8);p=wav+16;netmd_copy_doubleword_to_buffer(&p,16,1);
    netmd_copy_word_to_buffer(&p,1,1);netmd_copy_word_to_buffer(&p,2,1);
    netmd_copy_doubleword_to_buffer(&p,44100,1);netmd_copy_doubleword_to_buffer(&p,176400,1);
    netmd_copy_word_to_buffer(&p,4,1);netmd_copy_word_to_buffer(&p,16,1);
    memcpy(wav+36,"data",4);p=wav+40;netmd_copy_doubleword_to_buffer(&p,1764,1);
    FILE *f=fopen(filename,"wb");assert(f);assert(fwrite(wav,1,sizeof(wav),f)==sizeof(wav));assert(fclose(f)==0);
}
int main(int argc,char **argv){
    assert(argc==2);fixture(argv[1]);netmd_set_log_level(NETMD_LOG_NONE);
    const char *cases[]={"acquire","clear","protect","enter","key","nonce","setup","packets","send","cache","title","sync","commit","forget","leave","release",NULL};
    for(size_t i=0;i<sizeof(cases)/sizeof(cases[0]);i++){
        failure=cases[i];poisoned=opened=was_committed=prepared=sent=phase_calls=0;
        netmd_error result=netmd_send_track(NULL,argv[1],"Test track");
        if(!failure){assert(result==NETMD_NO_ERROR && was_committed && prepared==1 && sent==1);}
        else {assert(poisoned);assert(result==(was_committed?NETMD_RECORDING_COMMITTED_CLEANUP_FAILED:NETMD_USB_ERROR));}
        if(i<7){assert(prepared==0 && sent==0);}
    }
    remove(argv[1]);
    puts("Native recording lifecycle: 17 cases passed (stop at failed setup/transfer, identify committed cleanup failures).");
}
